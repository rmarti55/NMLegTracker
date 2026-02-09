# -*- perl -*-
#
# NMLegis::Bills - operations on bills (and resolutions and memorials)
#
package NMLegis::Bills;

use strict;
use warnings;

use Carp;
use Date::Parse;
use File::Basename;
use File::Slurp;
use HTML::Entities;
use JSON::XS;
use Tie::IxHash;
use Time::Piece;

use NMLegis                     qw(:all);
use NMLegis::Agendas;
use NMLegis::Committees;
use NMLegis::Legislators;
use NMLegis::Votes;

###############################################################################
# BEGIN user-configurable section

our $Bills_File = "$Data_Dir/bills-$YYYY.json";
our $Bills_Log  = "$Data_Dir/bills-$YYYY.log";

# Master list of all bills this session
# FIXME: The ?Session= arg does not work!
our $Bills_Index_URL = sprintf("%s/Legislation/Legislation_List?Session=%s",
                               $NMLEGIS, $YYYY);

# FIXME: YYYY *is not numeric!* Special sessions are '20s', '20s2'
our $Bills_Dir = sprintf("%s/nmlegis-watch/%d",
                         $ENV{XDG_DATA_HOME} || "$ENV{HOME}/.local/share",
                         $YYYY
                     );

# Table of all bills
our %Bills;

our $Bill_URL = "$NMLEGIS/Legislation/Legislation?Chamber=<chamber>&LegType=<type>&LegNo=<number>&year=<yy>";

our $Bill_Source_URL = "$NMLEGIS/Sessions/<yy>%20Regular/<type>/<chamber>";

# Chamber map
our %Chamber = (H => 'House', S => 'Senate');

# END   user-configurable section
###############################################################################

# Program name of our caller
(our $ME = $0) =~ s|.*/||;

# RCS id, accessible to our caller via "$<this_package>::VERSION"
(our $VERSION = '$Revision: 0.0 $ ') =~ tr/[0-9].//cd;

# For non-OO exporting of code, symbols
our @ISA         = qw(Exporter);
our @EXPORT      = qw();
our @EXPORT_OK   = qw($Bills_Log);
our %EXPORT_TAGS =   (all => \@EXPORT_OK);

###########
#  _init  #  load data file
###########
#
# FIXME: change %Bills so it's keyed by session??
#
sub _init {
    # FIXME: implement NMLegis->sessionid() ...?
    my $session = shift || $YYYY;
    return if exists $Bills{$session};

    my $bills_file = "$Data_Dir/bills-$session.json";

    return if ! -e $bills_file;
    my $json = read_file($bills_file);
    $Bills{$session} = decode_json($json);

    # 2026-01-17 FIXME! HB1 is scheduled in committee, but missing from nmlegis
    # FIXME! Will this exist in special sessions?
    $Bills{$session}{H}{B}{1} //= { actions => 'HPREF', sponsors => [], title => 'FEED BILL' };

    # 2024-01-24 Committee Votes
    if (-e (my $cvotes = "$Data_Dir/committee-votes-$YYYY.json")) {
        my $votes = decode_json(read_file($cvotes));
        for my $c (keys %$votes) {
            for my $t (keys(%{$votes->{$c}})) {
                for my $n (keys(%{$votes->{$c}{$t}})) {
                    for my $committee (keys(%{$votes->{$c}{$t}{$n}})) {
                        $Bills{$session}{$c}{$t}{$n}{votes}{$committee} =
                            $votes->{$c}{$t}{$n}{$committee};
                    }
                }
            }
        }
    }
}

#########
#  all  #  Return list of all bills
#########
sub all {
    my $session = $YYYY;
    if (@_) {
        $session = shift;
        $session =~ /^(\d{4}(s\d*)?)$/
            or croak "$ME: all(): invalid session '$session'";
        $session = $1;
        croak "$ME: all(): too many arguments" if @_;
    }

    _init($session);

    my @bills;
    for my $chamber (sort grep { /^[HS]/ } keys %{$Bills{$session}}) {
        for my $type (sort keys %{$Bills{$session}{$chamber}}) {
            for my $number (sort { $a <=> $b } keys %{$Bills{$session}{$chamber}{$type}}) {
                my $bill = $Bills{$chamber}{$type}{$number};

                # Recreate these (they're dups, hence not in the JSON)
                $bill->{session} = $session;
                $bill->{chamber} = $chamber;
                $bill->{type}    = $type;
                $bill->{number}  = $number;
                $bill->{name}    = "$chamber$type$number";

                push @bills, bless $bill, __PACKAGE__;
            }
        }
    }

    return @bills;
}

##################
#  sponsored_by  #  list of bills sponsored by a given legislator
##################
#
# This is a FUNCTION, not a METHOD!
#
sub sponsored_by {
    my $l    = shift;                   # in: legislator...
    # ...make it an object if not already so
    if (! ref($l)) {
        $l = NMLegis::Legislators->new($l);
    }

    _init();

    my @list;
    for my $bill (all()) {
        if (grep { $l->id eq $_->id } $bill->sponsors) {
            push @list, $bill;
        }
    }

    @list;
}

#########
#  new  #  Constructor.
#########
sub new($) {
    my $proto = shift;
    my $class = ref($proto) || $proto;

    croak "Usage: ".__PACKAGE__."->new( [search terms] )"       if ! @_;

    my $self;
    if (@_ == 1) {
        my $arg = shift;

        # CS = Committee Substitution; * = emergency
        #   ...see https://www.nmlegis.gov/Legislation/Action_Abbreviations
        #
        #          1        1 2  2 3   34              4   5   5
        $arg =~ m!^(CS[\s/]*)?(\*)?(H|S)(B|M|R|CR|JM|JR)\s*(\d+)$!
            or croak "$ME: Could not parse '$arg' as bill name";

        my ($cs, $emergency, $chamber, $type, $number) = ($1, $2, $3, $4, $5);
        $self = {
            chamber   => $chamber,
            type      => $type,
            number    => $number,
            name      => "$chamber$type$number",
            session   => $YYYY,                         # FIXME
        };

        $self->{cs}        = $cs        if defined $cs;
        $self->{emergency} = $emergency if defined $emergency;

        # WARNING: do not look up in @Bills! Because get-bills calls us!
    }

    croak "$ME: no match for bill '@_'" if ! $self;

    return bless $self, $class;
}

###########
#  _load  #  Get actual bill data
###########
sub _load {
    my $self = shift;

    return if $self->{_initialized};
    return if ref($self) =~ /::UI::/;   # Do not clobber a new ::UI object!

    my $session = $self->{session} || $YYYY;
    _init($session);

    my ($chamber, $type, $number) = @{$self}{'chamber','type','number'};

    my $name = "$chamber$type$number";

    # Progressively deeper lookup, with helpful errors
    my $bill = $Bills{$session} or do {
        carp "$ME: No bills available for $session";
        return;
    };
    $bill = $bill->{$chamber} or do {
        carp "$ME: $name: no '$chamber' bills available for $session"
            unless localtime->strftime("%m%d") lt '0120';
        return;
    };
    $bill = $bill->{$type} or do {
        carp "$ME: $name: no bills of type '$type' in '$chamber' for $session"
            unless localtime->strftime("%m%d") lt '0120';
        return;
    };
    $bill = $bill->{$number} or do {
        # Special case for HB1 prior to session open
        if ("$chamber$type$number" eq "HB1") {
            $self->{title} = "[Feed Bill]";
            $self->{actions} = 'HPREF';
            $self->{_initialized} = 1;
            return;
        }
        carp "$ME: $name not found in $session";
        return;
    };

    # Populate with nmlegis data
    for my $k (keys %$bill) {
        $self->{$k} //= $bill->{$k};
    }

    # Is this a bill Ed is actually tracking?
    # FIXME: I need to rewrite nmlegis-watch
    $self->{_am_tracking} = 0;

    $self->{_initialized} = 1;
}

###############################################################################
# BEGIN html fetch

################
#  fetch_html  #  arg = nul for main list, anything else is a bill
################
sub fetch_html {
    my $url;

    if (! @_) {
        $url = $Bills_Index_URL;
    }
    elsif (@_ == 1) {
        my $arg = shift;
        $arg =~ /^(H|S)(B|M|JM|R|JR)([0-9]+)$/
            or croak "$ME: fetch_html(): invalid arg '$arg', not a bill name";
        my %replace = ( chamber => $1, type => $2, number => $3, yy => $YY);
        ($url = $Bill_URL) =~ s|<(.*?)>|$replace{$1}|g;
    }
    else {
        croak "$ME: fetch_html(): invalid args '@_'";
    }

    return NMLegis::Scrape->fetch($url);
}

# END   html fetch
###############################################################################
# BEGIN accessors

sub get {
    my $self = shift;
    my $attr = shift;

    $self->_load;

    # YUK! Special case for mojo updatedb script: always want readable title
    if ($attr eq 'title') {
        if ((caller())[0] =~ /::UpdateDB/) {
            return $self->readable_title();
        }
    }

    if (exists $self->{$attr}) {
        return $self->{$attr};
    }
    if (my $handler = $self->can($attr)) {
        return $handler->($self);
    }

    # Mojo UI uses 'code' as identifier for everything
    return $self->{name} if $attr eq 'code';

    return '';
    #croak "Undefined attr '$attr'";
}


sub yy   { my $self = shift; return substr($self->session, 2, 2); }
sub yyyy { my $self = shift; return        $self->session; }

sub billno { my $self = shift; return $self->name; }

#########
#  url  #  autogenerated based on id
#########
sub url {
    my $self = shift;

    $self->_load;
    my $url = $Bill_URL;
    $url =~ s{<(.*?)>}{ $self->get($1) }gex;

    return $url;
}

################
#  source_url  #  For bills and committee reports
################
sub source_url {
    my $self = shift;

    # FIXME: have I missed any?
    my %typemap = (
        B  => 'bills',
        M  => 'memorials',
        JM => 'memorials',
        R  => 'resolutions',
        CR => 'resolutions',
        JR => 'resolutions',
    );

    my $url = $Bill_Source_URL;

    # Floor votes. FIXME!
    if (@_) {
        if ($_[0] =~ /^[HS][A-Z]{1,4}\d+[HS]VOTE\.PDF$/) {
            $url =~ s|(Regular/).*|$1|;
        }
    }

    $url =~ s{<yy>}{$self->yy}e;
    $url =~ s{<type>}{$typemap{$self->type}};
    $url =~ s{<chamber>}{lc $Chamber{$self->chamber}}e;

    $url .= "/$_[0]"       if @_;

    return $url;
}

###############
#  local_url  #  EXPERIMENTAL: local bill page
###############
sub local_url {
    my $self = shift;

    return sprintf("/bills/%s.html", $self->name);
}

###############
#  html_name  #  Nicer-looking bill name with small type, bold number
###############
sub html_name {
    my $self = shift;

    $self->_load;
    sprintf("<small>%s%s%s</small><b>%s</b>",
            ($self->{emergency} ? '*' : ''),
            map { $self->get($_) } qw(chamber type number));
}

sub chamber_name {
    my $self = shift;

    $self->_load;
    my $chamber = uc($self->chamber);
    return $Chamber{$chamber}
        || die "$ME: Internal error: unknown chamber '$chamber' for $self";
}

sub type_name {
    my $self = shift;

    $self->_load;
    my $type = $self->type;

    my $name = '';
    $name = 'Joint '      if $type =~ s/^J//;
    $name = 'Concurrent ' if $type =~ s/^C//;
    my %map = (
        B => 'Bill',
        M => 'Memorial',
        R => 'Resolution',
    );

    exists $map{$type}
        or die "$ME: Internal error: unknown type '$type' for $self";
    return $name . $map{$type};
}


#################
#  css_classes  #  watching, evil, dead
#################
sub css_classes {
    my $self = shift;
    my @classes;

    $self->_load;
    push @classes, 'evil'       if $self->{is_evil};
    push @classes, 'watching'   if $self->{_am_tracking};
    if ($self->location) {
        push @classes, 'active';
    }
    elsif ($self->tabled) {
        push @classes, 'tabled';
    }
    else {
        push @classes, 'inactive';
    }

    return @classes;
}

####################
#  readable_title  #  Mixed-case
####################
sub readable_title {
    my $self = shift;

    $self->_load;
    my $title = $self->title;
    my @words = split ' ', $title;

    # Search term: Acronyms/abbreviations and upper/lower case
    my %keep_lc = map { uc($_) => $_ } qw(a and as at by for in of on or the to with);
    my %keep_uc = map { uc($_) => $_ } qw(ABQ AFB AI ALS ARPA CA COVID CPA CSG CYFD D.C. DFA DOT DWI EMNRD EMS EMT ERB FFA GRT HMO ID IPRA IRB LEDA LESC LFC LGBT LGBTQ LGBTQ+ MFA MLK MRI NM NMED NMFA NMMI NMSU PAs PB&J PERA PRC PTSD RETA RLD RN STB STI UNM YMCA);
    for my $word (@words) {
        # To work around quoted titled: "new Mexico Food ..."
        my $q = '';
        $q = $1 if $word =~ s/^(")//;

        if ($keep_lc{$word}) {
            $word = lc $word;
        }
        elsif ($keep_uc{$word}) {
            # May be mixed-case: "PAs"
            $word = $keep_uc{$word};
        }
        else {
            # Properly handle "NM-Grown"
            $word = join('-', map {
                $keep_uc{uc $_} || $keep_lc{uc $_} || ucfirst(lc($_))
            } split('-', $word));
        }

        $word = "$q$word";
    }

    push @words, '- OPPOSE'     if $self->{is_evil};
    return join(' ', @words);
}

##############
#  sponsors  #  list of ::Legislator objects
##############
sub sponsors {
    my $self = shift;

    $self->_load;
    my $sponsors = $self->{sponsors} or do {
        # This is only OK for HB1
        carp "$ME: $self->{name} has no sponsors"
            unless $self->{name} eq "HB1";
        return;
    };

    return map { NMLegis::Legislators->new( $_ ) } @$sponsors;
}

#############
#  sponsor  #  (singular): just the primary sponsor
#############
sub sponsor {
    my $self = shift;

    my @sponsors = $self->sponsors;
    return $sponsors[0];
}


##############
#  location  #  Committee schedule
##############
sub location {
    my $self = shift;

    $self->{location} //= NMLegis::Agendas::find_bill($self);
}

#########
#  fir  #  Financial Impact Report, if any
#########
sub fir {
    my $self = shift;

    return $self->_find_analysis('firs');
}

sub lescanalysis {
    my $self = shift;

    return $self->_find_analysis('LESCAnalysis');
}

sub lfcform {
    my $self = shift;

    return $self->_find_analysis('LFCForms');
}

sub _find_analysis {
    my $self = shift;
    my $type = shift;           # firs, LESCAnalysis, LFCForms

    my $c = $self->chamber;
    my $t = $self->type;
    my $n = $self->number;

    my @match = grep { m!/${c}${t}0*${n}\.PDF$! } glob("/home/esm/.cache/nmlegis/mirror-bills/$YYYY/$type/$c$t*$n.PDF")
        or return;

    return sprintf("https://nmlegis.gov/Sessions/%d%%20Regular/$type/%s",
                   $YY, basename($match[0]));
}

####################
#  _parse_actions  #  Internal helper, parses nmlegis 'X/Y-Z' strings
####################
sub _parse_actions {
    my $actions = shift;
    my $actions_saved = $actions;

    my %history = (actions => $actions);
    my $day = 0;

    # 2025-01-22 HB34 has spurious trailing backtick
    # 2025-02-03 a LOT of bills now have spurious backticks in random places
    $actions =~ s/\`//g;

    # Strip leading/trailing whitespace
    $actions =~ s/^\s+|\s+$//g;

    while ($actions) {
        # 2025-03-12 trailing "- " seen in HB457. Typo, but, deal with it.
        #                    1   12 3   3 4       4 2
        if ($actions =~ s!^\[(\d+)(<(\d+):(\S[^>]+)>)?\]\s*(-\s*)?!!) {
            $day = $1;

            # User-reported action. This is terminal; we return from here.
            # FIXME: this eliminates the ability to see multiple rows,
            # such as past hearings. Find a way to resolve that!
            if ($2) {
                my ($t, $who) = ($3, $4);
                my $when = localtime($t)->strftime("%b %e");

                my $msg = $actions;
                $msg .= " in $history{cur}"
                    if $history{cur}
                    && $history{cur} ne '???'
                    && $actions ne 'withdrawn';
                $msg .= " [$when: unofficial report from $who]";

                push @{$history{history}}, [ $day, $actions, $history{cur}, $msg ];
                push @{$history{$actions}},
                    [ $day, $history{cur}, " - $msg" ];
### FIXME: What was this for?? Enabling it makes the status consume everything
###                $history{user_report} = [ $actions, $msg ];

                return \%history;
            }
        }

        # Prefile
        elsif ($actions =~ s!^(H|S)PREF\s+!!) {
            push @{$history{history}}, [ $day, 'prefile', $1 ];
        }

        # Do Pass, or
        # Do Not Pass, but Do Pass with Committee Substitution
        # https://nmlegis.gov/Legislation/Action_Abbreviations
        elsif ($actions =~ s!^((DNP-CS/)?DP(/a)?)(-([A-Z]+))?([\.\s\-]+|$)!!) {
            my ($how, $cur) = ($1, $5);

            $cur = "Speaker's Table" if ($cur||'') eq 'T';

            my $friendly = $how;
            if ($how =~ /DNP-CS/) {
                $friendly = "with Committee Substitution";
            }
            elsif ($how =~ m!DP/a!) {
                $friendly = "with Do Pass, as amended";
            }
            else {
                $friendly = "with Do Pass recommendation";
            }
            push @{$history{passed}},  [ $day, $history{cur}, $friendly ];
            push @{$history{history}}, [ $day, 'passed', $history{cur}, $how ];
            push @{$history{history}}, [ $day, 'sent', $cur ]  if $cur;
            if ($cur) {
                $history{cur} = $cur;
            }
            else {
                # 2024-02-06 Just "DP" without a prior "sent", like SB6
                # in our test suite. Try a process of elimination.
                $history{cur} = '???';
                if (my $refer = $history{refer}) {
                    my %refer = map { $_ => 1 } @$refer;
                    for my $h (@{$history{history}}) {
                        if ($h->[1] =~ /^(passed|germane)$/) {
                            if (my $where = $h->[2]) {
                                delete $refer{$where};
                            }
                        }
                    }

                    if (my @next = keys %refer) {
                        if (@next == 1) {
                            $history{cur} = $next[0];
                        }
                        else {
                            #warn "FIXME: ambiguous empty referral, could be '@next'";
                            ;
                        }
                    }
                    else {
                        #warn "FIXME: empty referral with no possibilities '$actions'";
                        ;
                    }
                }
            }
        }

        # Do Not Pass, w/o rec
        elsif ($actions =~ s!^(DNP-CS/w/o\s+rec)[\s\-]+!!) {
            my $friendly = "with Committee Subst., w/o recommendation";
            push @{$history{passed}},  [ $day, $history{cur}, $friendly ];
            push @{$history{history}}, [ $day, 'passed', $history{cur}, $1 ];
            delete $history{cur};
        }

        # FIXME: w/o recommendation -- should this really be "passed"???
        elsif ($actions =~ s!^(w/o\s+rec(/a)?)(-([A-Z]+))?([\s\-]+|$)!!) {
            push @{$history{passed}},  [ $day, $history{cur}, "without recommendation" ];
            push @{$history{history}}, [ $day, 'passed', $history{cur}, $1 ];
            $history{cur} = $4;
        }

        elsif ($actions =~ s!^PASSED/(H|S)\s+\((\d+-\d+)\)([\.\s\-]+|$)!!) {
            my $chamber = $Chamber{$1} || die "No chamber for '$1'";
            push @{$history{passed}},   [ $day, $chamber, $2 ];
            push @{$history{history}},  [ $day, 'passed', $chamber, $2 ];
            delete $history{cur};
            delete $history{refer};
            delete $history{tabled};
        }

        elsif ($actions =~ s!^FAILED/(H|S)\s+\((\d+-\d+)\)([\.\s\-]+|$)!!) {
            my $chamber = $Chamber{$1} || die "No chamber for '$1'";
            $history{failed}          = [ $day, $chamber, $2 ];
            push @{$history{history}},  [ $day, 'failed', $chamber, $2 ];
            $history{cur} = 'failed';
            delete $history{refer};
            delete $history{tabled};
        }

        # First time seen: 2025 SJR1
        elsif ($actions =~ s!^(DNP\.)\s*!!) {
            if (my $cur = $history{cur}) {
                $history{failed}         = [ $day, $cur, $1 ];
                push @{$history{history}}, [ $day, 'failed', $cur, $1 ];
                $history{cur} = 'failed';
                delete $history{refer};
                delete $history{tabled};
            }
        }

        elsif ($actions =~ s!^(SGND.*)!!) {
            my $signed = $1;
            $history{signed} = {};
            if ($signed =~ /\((\w+[\.\s]+\d+)\)/) {
                if (my $t = str2time($1)) {
                    my $lt = localtime($t);
                    $history{signed}{date} = [ $lt->mon, $lt->mday, $lt->strftime("%B %e") ];
                }
                else {
                    warn "$ME: Could not grok 'Mmm. dd' in '$signed'";
                }
            }
            if ($signed =~ /Ch[\.\s]+(\d+)/) {
                $history{signed}{ch} = $1;
            }
            if ($signed =~ /((partial\s+)?veto)/) {
                $history{signed}{veto} = $1;
            }

            push @{$history{passed}},   [ $day, 'signed', $signed ];
            push @{$history{history}},  [ $day, 'signed', $signed ];
            $history{cur} = 'signed';
            delete $history{refer};
        }

        # 2023-03-18 seen in HB127, SB27, a few others
        elsif ($actions =~ s!^(LAW WITHOUT SIGNATURE.*)!!) {
            push @{$history{passed}},   [ $day, 'unsigned', $1 ];
            push @{$history{history}},  [ $day, 'unsigned', $1 ];
            $history{cur} = 'unsigned';
            delete $history{refer};
        }

        # 2023-04-07 today some bills appeared with double VETO
        elsif ($actions =~ s!^((POCKET\s+)?VETO)([\.\s-]*VETO)?[\.\s\-]*$!!) {
            push @{$history{history}},  [ $day, 'vetoed', $1 ];
            $history{cur} = 'vetoed';
            $history{cur} = 'pocket vetoed' if $2;
            delete $history{refer};
        }

        elsif ($actions =~ s/^VETO[\.\s-]+(.*VETO OVERRIDE PASSED)/$1/) {
            push @{$history{history}},  [ $day, 'vetoed', 'VETO' ];
            $history{cur} = 'vetoed';
            delete $history{refer};

            if ($actions =~ m!VETO OVERRIDE PASSED/[HS].*OVERRIDE PASSED/[HS]!) {
                warn "FIXME!!!!!! Veto override passed both!";
            }
        }

        elsif ($actions =~ s!^VETO OVERRIDE PASSED/(H|S)\s+\((\d+-\d+)\)([\.\s\-]+|$)!!) {
            my $chamber = $Chamber{$1} || die "No chamber for '$1'";
            push @{$history{history}},  [ $day, "veto override passed", $chamber, $2 ];
        }

        # Committee referral, with current committee
        #                     1         1 2           2 3      34         5      54 6       6
        elsif ($actions =~ s!^(ref[\s-]+)?([HS][A-Z/]+)-([A-Z]+)(-germane-([A-Z]+))?(-?\s+|$)!!) {
            $history{cur} = $3;
            $history{refer} = [ split('/', $2) ];
            push @{$history{history}}, [ $day, 'referred', $2 ];
            push @{$history{history}}, [ $day, 'sent',     $3 ];
            if ($4) {
                # This makes the 'SCC' row go green
                push @{$history{passed}},  [ $day, $history{cur}, "Germane" ];
                push @{$history{history}}, [ $day, 'germane',  $5 ];
                $history{cur} = $5;
            }
        }

        # RE-referral; can be "re-ref" or "re-referred to" (2023 HB95)
        #                     1         2     2       13              3
        elsif ($actions =~ s!^(re-ref\w*(\s+to)?[\s-]+)([HS][A-Z]{2,5})([\s\-]+|$)!!) {
            push @{$history{refer}}, $3;
            push @{$history{history}}, [ $day, 're-referred', $3 ];

            $history{cur} = $3;
            if ($actions =~ s!^([HS]{2,5})[\s-]+!!) {
                $history{cur} = $1;
            }
        }

        # Withdraw referral
        elsif ($actions =~ s!^((H|S)[A-Z]{2,5})\s+ref\s+w/drn([\.\s\-]+|$)!!) {
            my $remove = $1;
            push @{$history{history}}, [ $day, 'ref withdrawn',  $remove ];

            my $r = $history{refer};
            my @match = grep { $r->[$_] eq $remove } (0..$#$r);
            if (! @match) {
                warn "$ME: Impossible: did not find '$remove' in '@$r'";
                # Cross fingers and keep going
                next;
            }
            splice @$r, $match[0], 1;
        }

        # REMOVE referral
        elsif ($actions =~ s!^((H|S)[A-Z]{2,5})\s+ref(erral)?\s+removed([\.\s\-]+|$)!!) {
            my $remove = $1;
            push @{$history{history}}, [ $day, 'referral removed',  $remove ];

            my $r = $history{refer};
            my @match = grep { $r->[$_] eq $remove } (0..$#$r);
            if (! @match) {
                warn "$ME: Impossible: did not find '$remove' in '@$r'";
                # Cross fingers and keep going
                next;
            }
            splice @$r, $match[0], 1;
        }

        # WTF is this? Just 'HRC/SRC' by itself, or just one committee?
        elsif ($actions =~ s!^(ref[\s\-]+)?((H|S)[A-Z]{2,5})([\s\-]+|$)!!) {
            $history{cur} = $2;
            $history{refer} = [ $2 ];
            push @{$history{history}}, [ $day, $2 ];
        }

        # another WTF -- this is temporary, I think???
        elsif ($actions eq 'T') {
            $history{cur} = "Speaker's Table";
            push @{$history{history}}, [ $day, "on $history{cur}" ];
            $actions = '';
        }

        # Action Postponed Indefinitely
        elsif ($actions =~ s!^(((H|S)[A-Z]{2,5})\s+)?API([\s\.\-]+|$)!!) {
            my $who = $2 || $history{cur} || '';
            if ($2) {
                $history{refer} = [ $2 ];
            }
            push @{$history{history}}, [ $day, 'API', $who ];

            # FIXME: add a 'failed' table? Somehow signal a stall here?
            $history{failed}         = [ $day, 'API', $who ];


            # API must always be the final action
            warn "$ME: WEIRD! 'API' followed by '$actions'" if $actions;
        }

        elsif ($actions =~ s!^(no?t (prntd|ref com))([\s\.\-]+|$)!!) {
            $history{cur} = 'limbo';
            push @{$history{history}}, [ $day, $1 ];
        }

        elsif ($actions =~ s!^prntd([\s\.\-]+|$)!!) {
            # 2024-01-25 "w/drn-prntd-ref"
            $actions =~ s!^ref([\s\.\-]+|$)!!;
            push @{$history{history}}, [ $day, "printed" ];
        }

        elsif ($actions =~ s!^w/drn([\s-]+|$)!!) {
            $history{cur} = 'withdrawn';
            push @{$history{history}}, [ $day, 'withdrawn' ];
        }

        elsif ($actions =~ s!^(fl/a+)([\.\s\-]+|$)!!) {
            push @{$history{history}}, [ $day, 'floor amendment', $1 ];
        }

        elsif ($actions =~ s!^(fl/sub\s+adptd)[\.\s\-]+!!) {
            push @{$history{history}}, [ $day, 'floor sub adopted', $1 ];
        }

        elsif ($actions =~ s!^((h|s)/cncrd)([\.\s\-]+|$)!!) {
            my $chamber = $Chamber{ uc($2) } || do {
                warn "$ME: Impossible: No chamber '$2'";
                "Chamber-$2";
            };
            push @{$history{passed}},  [ $day, "$chamber concur", $1 ];
            push @{$history{history}}, [ $day, "$chamber concur", $1 ];
        }

        elsif ($actions =~ s!^(rcld\s+frm/h)([\.\s-]+|$)!!) {
            $history{cur} = 'Recalled from House';
            push @{$history{history}}, [ $day, "recalled from House", $1 ];
        }

        # Trouble
        elsif ($actions =~ s!^((h|s)/fld\s+(cncr|recede))([\s\-]+|$)!!) {
            my $chamber = $Chamber{ uc($2) } || do {
                warn "$ME: Impossible: No chamber '$2'";
                "Chamber-$2";
            };
            my $what = $3;
            $what = 'concur' if $what eq 'cncr';
            push @{$history{history}}, [ $day, "$chamber failed to $what", $1 ];
        }

        # 2023-03-18 last day of session
        elsif ($actions =~ s!^((h|s)/recede)([\s\-]+|$)!!) {
            my $chamber = $Chamber{ uc($2) } || do {
                warn "$ME: Impossible: No chamber '$2'";
                "Chamber-$2";
            };
            push @{$history{history}}, [ $day, "$chamber recede", $1 ];
        }

        elsif ($actions =~ s!^CC([\s\-]+|$)!!) {
            push @{$history{history}}, [ $day, "Conf. Committee" ];
        }

        elsif ($actions =~ s!^m/rcnsr\s+adptd([\s\.\-]+|$)!!) {
            push @{$history{history}}, [ $day, "motion to reconsider adopted" ];
        }

        elsif ($actions =~ s!^((h|s)/rpt\s+(adptd))([\s\-]+|$)!!) {
            my $chamber = $Chamber{ uc($2) } || do {
                warn "$ME: Impossible: No chamber '$2'";
                "Chamber-$2";
            };
            push @{$history{history}}, [ $day, "$chamber report adopted", $1 ];
        }

        elsif ($actions =~ s!^((h|s)/calendar)[\s-]+!!) {
            my $c = $Chamber{uc $2};
            push @{$history{history}}, [ $day, "$c Calendar", $1 ];
        }

        elsif ($actions =~ s!^germane-((H|S)[A-Z]{2,5})[\.\s\-]+!!) {
            # e.g. "germane-SJC" means "SCC has ruled germane, sent to SJC"
            push @{$history{history}}, [ $day, "germane", $history{cur} ];
            push @{$history{history}}, [ $day, "sent", $1 ];
            push @{$history{passed}},  [ $day, $history{cur}, "Germane" ];
            $history{cur} = $1;
        }

        elsif ($actions =~ s!^germane-!!) {
            # or this??
            push @{$history{history}}, [ $day, "germane", $history{cur} ];
        }

        elsif ($actions =~ s!^nt\s+germane([\s\.-]+|$)!!) {
            # or this??
            push @{$history{history}}, [ $day, "not germane" ];
        }

        elsif ($actions =~ s!^(tbld(/([HS]))?)([\s-]+|$)!!) {
            delete $history{cur};
            $history{tabled} = 1;
            push @{$history{history}}, [ $day, 'tabled' ];
            if ($2) {
                push @{$history{history}[-1]}, $Chamber{$3};
            }
        }

        elsif ($actions =~ s!^TBLD\s+INDEF([\s\.\-]+|$)!!) {
            delete $history{cur};
            $history{tabled} = 1;
            push @{$history{history}}, [ $day, 'tabled indefinitely' ];
        }

        # 2022-02-15: this seems to be a terminal action
        elsif ($actions =~ s!\s*\(Succeeding entries:\s+(H|S)\s+(\d+)\)\.!!) {
            # FIXME: implicit 'B' is not safe, but in this function we
            # don't actually know the name of our bill.
            $history{cur} = "Merged into ${1}B${2}";
            push @{$history{history}}, [ $day, "merged into ${1}B${2}" ];

            warn "$ME: Unexpected text after 'Succeeding entries': $actions\n"
                if $actions;
        }

        else {
            warn "$ME: Cannot grok '$actions' (from '$actions_saved'), cannot continue";
            return \%history;
        }
    }

    return \%history;
}

#############
#  history  #  Interpreted actions
#############
sub history {
    my $self = shift;

    $self->_load;

    my $history = _parse_actions($self->actions);

    # If we have a log file, look in it
    if (open my $log_fh, '<', $Bills_Log) {
        while (my $line = <$log_fh>) {
            chomp $line;
            my ($bill, $committee, $date) = split ' ', $line;
            if ($bill eq $self->name) {
                $history->{scheduled}{$committee} = $date;
                if ($committee eq ($history->{cur}||'')) {
                    $history->{heard} = $date;
                }
            }
        }
        close $log_fh;
    }

    # 2025-02-01 new feature: manual bill-committee reports.
    # File format is, e.g., "HB39  HCPAC  Passed  Meredith"
    if (open my $log_fh, '<', "$Bills_Log.manual") {
        while (my $line = <$log_fh>) {
            chomp $line;
            my ($bill, $committee, $status, $who) = split ' ', $line;
            if ($bill eq $self->name) {
                if ($committee eq ($history->{cur}||'')) {
                    if ($status =~ /(passed|failed|tabled)/i) {
                        $history->{manual_update} = [ lc($1), $who ];
                    }
                    else {
                        # FIXME: maybe Tabled, or Failed?
                        warn "$ME: $Bills_Log.manual:$.: Cannot grok status '$status'";
                    }
                }
            }
        }
        close $log_fh;
    }

    return $history;
}

##############
#  html_row  #  One entire row showing bill info
##############
sub html_row {
    my $self = shift;
    $self->_load();

    # First of all, get the committee info. This will be one or more
    # blah blah FIXME
    my @committee_progress = $self->html_progress_table;
    my $rowspan = '';
    if (@committee_progress > 1) {
        $rowspan = sprintf(" rowspan=\"%d\"", scalar(@committee_progress));
    }

    my $row = sprintf("<tr class=\"%s\">", join(' ', "newbill", $self->css_classes));
    (my $tr = $row) =~ s|\bnewbill\b||;

    # Bill Number
    $row .= sprintf("<td class=\"id\"%s><a href=\"%s\" target=\"_blank\">%s</a>",
                    $rowspan, $self->local_url, $self->html_name);
    # Are there any financial reports?
    if ($self->fir || $self->lescanalysis || $self->lfcform) {
        $row .= "&#x1F4B2;";            # heavy green dollar sign
    }
    else {
        $row .= "&nbsp;";
    }
    $row .= "</td>";

    # Bill Title
    $row .= sprintf("<td class=\"billtitle\"%s>%s</td>",
                    $rowspan, encode_entities($self->readable_title));

    # Sponsor(s)
    $row .= sprintf("<td%s>", $rowspan);
    if (my $sponsor = $self->sponsor) {
        $row .= $sponsor->full_link('lastname', { bill => $self });
    }
    else {
        $row .= "[N/A]";
    }
    $row .= "</td>";

    if (@committee_progress) {
        my $next_tr = '';
        for my $cell (@committee_progress) {
            $row .= "${next_tr}${cell}</tr>";
            $next_tr = $tr;
        }
    }
    else {
        # The long ASDF-ASDF-ASDF string
        $row .= sprintf("<td colspan='4'>%s</td></tr>", $self->actions);
    }

    $row . "\n";
}

#########################
#  html_progress_table  #  Table with two or three elements showing committees
#########################
sub html_progress_table {
    my $self = shift;

    my $history = $self->history || return;

    # FIXME! This just returns one table cell for an entire user report,
    # losing committee history. It's just too hard to do otherwise, but
    # maybe one day I can refactor all this code.
    if (my $user_report = $history->{user_report}) {
        my ($status, $msg) = @$user_report;
        return "<td colspan=\"4\" class=\"$status\">$msg</td>";
    }

    my $cur = $history->{cur} || '';
    if ($cur eq 'signed') {
        my $text = 'Signed';
        if (my $when = $history->{signed}{date}) {
            $text .= " " . $when->[2];
        }
        if (my $ch = $history->{signed}{ch}) {
            $text .= " - Ch. " . $ch;
        }
        if (my $v = $history->{signed}{veto}) {
            $text .= " <i>($v)</i>";
        }
        return "<td colspan=\"4\" class=\"signed\">$text</td>";
    }
    elsif ($cur eq 'vetoed' || $cur eq 'pocket vetoed') {
        my $status = uc($cur);
        if (my $last_action = $history->{history}[-1]) {
            if ($last_action->[1] eq 'veto override passed') {
                $status .= " (@{$last_action}[1,2,3])";
            }
        }
        return "<td colspan=\"4\" class=\"vetoed\">$status</td>";
    }
    elsif ($cur eq 'failed') {
        my $text = 'FAILED';
        if (my $who = $history->{failed}) {
            $text .= " $who->[1] $who->[2]";
        }
        return "<td colspan=\"4\" class=\"failed\">$text</td>";
    }
    elsif ($cur eq 'withdrawn') {
        return "<td colspan=\"4\" class=\"failed\">withdrawn</td>";
    }

    # FIXME special case, whatever this means
    if ($cur =~ /Speak.*Table/) {
        return "<td colspan=\"4\" class=\"speakertable\">On $cur</td>";
    }
    if ($cur =~ /Recalled/) {
        return "<td colspan=\"4\" class=\"limbo\">$cur</td>";
    }

    if ($cur =~ /Merged into (\S+)/) {
        my $into = $1;
        my $href = sprintf("<a href=\"%s\">%s</a>",
                           NMLegis::Bills->new($into)->local_url,
                           $into);
        return "<td colspan=\"4\" class=\"tabled\">[Merged into $href]</td>";
    }

    if (my $tabled = $self->tabled) {
        my $msg = '';
        if ($cur) {
            $msg = "<td>$cur</td><td colspan=\"3\">";
        }
        else {
            $msg = "<td colspan=\"4\">";
        }
        if ($tabled =~ /^[HS].*T\.(?i)pdf$/) {
            # FIXME
            my $url = "https://nmlegis.gov/Sessions/$YY%20Regular/Tabled_Reports/$tabled";

            $msg .= "<a href=\"$url\" target=\"_blank\"><b>Tabled in committee</b></a>";
        }
        else {
            $msg .= encode_entities($tabled);   # FIXME: can this happen?
        }
        return "$msg</td>";
    }

    # FIXME: handle if in house/senate floor, passed committees
    my @stack;
    if (my $passed = $history->{passed}) {
        my %passed_chamber;

        for my $p (reverse @$passed) {
            my $where = $p->[1];
            if (! $where) {
                warn "$ME: GOT HERE - undefined pass!\n";
                use Data::Dump;
                dd $history;
            }

            my $c = substr($where, 0, 1);
            next if $passed_chamber{$c};

            my $when = '';
            if (my $date = $history->{scheduled}{$where}) {
                if ($date eq localtime(time-86400)->ymd) {
                    $when = ' yesterday';
                }
                else {
                    my $t = str2time($date);
                    $when = localtime($t)->strftime(", %b %e,");
                }
            }

            # x2713 = checkmark
            my @class = qw(passed);
            # See above, for skipping committees
            if ($where =~ /^(House|Senate)$/) {
                my $c = substr($1, 0, 1);
                $passed_chamber{$c} = 1;
                push @class, 'chamber';
            }

            my $passed = sprintf("Passed%s %s", $when, $p->[2] || '');
            $passed = 'Germane' if $passed =~ /germane/i;

            # FIXME FIXME: this does not handle SCC/SXCC
            my $href = "<a href=\"/committees/$where\">$where</a>";
            $href = "<b>$where</b>"  if $where =~ /concur/;
            unshift @stack, "<td class=\"@class\">$href &#x2713;</td><td class=\"@class\" colspan=\"3\">$passed</td>";
        }
    }

    my $loc = $self->location;

    # On House or Senate floor
    if ($loc && $loc->{cname} =~ /[a-z]/) {         # e.g. House, Senate
        my $block = sprintf("<td>%s</td>", encode_entities($loc->{cname}));

        # FIXME: deduplicate!!!
        $block .= "<td>";
        if (my $pdf = $loc->{url}) {
            my $alt = "PDF calendar source";
            if (my $mtime = $loc->{mtime}) {
                $alt .= ", last updated $mtime";
            }

            # 1F5D3 = calendar
            $block .= sprintf("<a href=\"%s\" title=\"%s\" target=\"_blank\">&#x1F5D3;</a> ", $pdf, $alt);
        }

        my $t = str2time($loc->{date});
        $block .= sprintf("%s</td><td>%s</td><td>%s",
                          localtime($t)->strftime("%a %b %e"),
                          $loc->time,
                          $loc->room);
        if (my $zoom = $loc->zoom_button) {
            $block .= "&nbsp;$zoom";
        }
        $block .= "</td>";

        return $block;
    }

    # No schedule, and no committee referrals
    if (! $loc && ! ref($history->{refer})) {
        # If status is "Passed [one chamber]", add "Needs to pass OTHER"
        if (@stack == 1) {
            if ($stack[0] =~ m!passed\s*chamber.*/(House|Senate)!) {
                # Not on memorials! (FIXME: what about Resolutions?)
                unless ($self->type eq 'M') {
                    my %other = (House => 'Senate', Senate => 'House');
                    push @stack, "<td colspan=\"2\">[ No $other{$1} referrals yet ]</td>";
                }
            }
        }
        return @stack;
    }

    my $indent = '';
  REFERRAL:
    for my $need (@{$history->{refer}}) {
        my $cells = '';

        # AAARGH! 2024-01-16 why the Xs??
        my $c = eval { NMLegis::Committees->new($need) };

        my $class = '';
        my $checkmark = '';
        my $tooltip = '';
        if ($history->{passed}) {
            if (grep { $need eq $_->[1] } @{$history->{passed}}) {
                # Already shown in 'passed' stack above
                next;
            }
        }

        if (!$class) {
            if ($need eq ($history->{cur}||'')) {
                if (!$loc && (my $heard = $history->{heard})) {
                    $class = 'heard';
                    $checkmark = ' &#x2753;';   # red question mark
                    my $when = str2time($heard);
                    if (time - $when > 4 * 86400) {
                        $class .= "-long-ago";
                    }
                }
                else {
                    $class = 'current';
                    if ($loc && $loc->{datetime}) {
                        # 3 hours after committee start, assume it's been heard
                        my $t = str2time($loc->{datetime});
                        if ($t < time - 3*3600) {
                            $class = 'heard';
                            $checkmark = ' &#x2753;';   # red question mark
                        }
                    }
                    else {
                        $tooltip .= "<i>[Referred, not scheduled]</i>";
                    }
                }
            }
            else {
                $class = 'future';
                $indent = '&nbsp;&rarr;&nbsp;';
            }
        }

        $cells .= "<td class=\"billprogress $class";
        $cells .= " mylegislator" if ($c) && (grep { $_ eq $c->code } @_);
        $cells .= "\">";

        if ($c) {
            my $url = $c->local_url;
            $cells .= "<span class=\"$class\"><a href=\"$url\">$need</a>$checkmark</span>";
        }
        else {
            $cells .= $need;
        }
        $cells .= "</td>";

        # 2025-02-05 AAARGH! This is now TRIPLICATED!
        if ($loc && ($loc->{name} eq $need) && $history->{manual_update}) {
            my ($status, $who) = @{$history->{manual_update}};
            $cells .= "<td class=\"$status\" colspan=\"3\">$who reports it as $status in committee</td>";
        }

        elsif ($loc && $loc->{name} eq $need && $class !~ /heard/) {
            my $t = localtime(str2time($loc->{datetime}));

            $cells .= "<td>";

            if (my $pdf = $loc->{url}) {
                my $alt = "PDF calendar source";
                if (my $mtime = $loc->{mtime}) {
                    $alt .= ", last updated $mtime";
                }

                # 1F5D3 = calendar
                $cells .= sprintf("<a href=\"%s\" title=\"%s\" target=\"_blank\">&#x1F5D3;</a> ", $pdf, $alt);
            }

            $cells .= sprintf("%s</td><td>%s</td><td>%s",
                              $t->strftime("%a %b %e"),
                              $loc->time,
                              $loc->room);
            if (my $zoom = $loc->zoom_button) {
                $cells .= "&nbsp;$zoom";
            }
            $cells .= "</td>";
        }
        elsif ($class =~ /heard/) {
            if ($need eq $cur) {
                my $msg;

                if (my $report = $history->{manual_update}) {
                    my ($status, $who) = @{$history->{manual_update}};
                    $class = $status;
                    $msg = "$who reports as $status in committee";
                }

                # 2024-01-24 new CommitteeVotes
                elsif ($loc && $loc->{datetime}) {
                    my $when = str2time($loc->{datetime});
                    if (localtime($when)->ymd eq localtime->ymd) {
                        $msg = "Was scheduled for this ";
                        if (localtime($when)->hour < 12) {
                            $msg .= "morning";
                        }
                        else {
                            $msg .= "afternoon";
                        }
                        $msg .= ".<br/>There is currently no way to obtain real-time results, sorry.";
                    }
                    else {
                        warn "$ME: WEIRD: $loc->{datetime} is not today!";
                        $msg = "Possibly heard, but I don't know when.";
                    }
                }
                elsif ($history->{heard}) {
                    my $when = str2time($history->{heard});
                    my $date = localtime($when)->strftime("%b %e");

                    if ($self->{votes}{$cur}) {
                        $msg = "[Heard in committee, $date. Vote taken.";
                        if (time - $when > 2 * 86400) {
                            $msg .= " Presumed stalled.";
                            $class = 'heard-long-ago';
                        }
                        $msg .= ']';
                    }
                    elsif (my $report = $history->{manual_update}) {
                        my ($status, $who) = @{$history->{manual_update}};
                        $class = $status;
                        $msg = "$date: $who reports as $status in committee";
                    }
                    elsif ($class =~ /ago/) {
                        $msg = "Was scheduled for $date. No vote recorded. Presumed stalled.";
                    }
                    else {
                        $msg = "Possibly heard on $date; it may take 1-2 days to learn status.";
                    }
                }
                elsif ($self->{votes}{$cur}) {
                    $msg = "Heard in committed. Voted on. Probably stalled.";
                    $class = 'heard-long-ago';
                }

                $cells .= "<td class=\"$class\" colspan=\"3\">$msg</td>";
            }
            else {
                $cells .= "<td class='inactive' colspan='3'>$tooltip</td>";
            }
        }
        else {
            $cells .= "<td class='inactive' colspan='3'>$tooltip</td>";
        }

        push @stack, $cells;
    }

    return @stack;
}



##############
#  AUTOLOAD  #
##############
use vars qw($AUTOLOAD);
sub AUTOLOAD {
    my $self = shift;

    (my $attr = $AUTOLOAD) =~ s/^.*:://;
    $self->get($attr);
}

sub DESTROY {}

use overload '""' => sub { $_[0]->name };

# END   accessors
###############################################################################
# BEGIN complicated accessors

#############
#  updates  #  History of fetch actions from nmlegis
#############
sub updates {
    my $ndays = shift;

    my %updates;

    my $ymd_ndays_ago = localtime(time - $ndays * 86400)->ymd;
    my $history_dir = "$Data_Dir/history";

    my @ymd_dirs = grep { $_ ge $ymd_ndays_ago } read_dir($history_dir);
    for my $ymd (@ymd_dirs) {
        my @hms_files = grep { /\.json$/ } read_dir("$history_dir/$ymd");
        for my $hms_file (@hms_files) {
            my $tmp = decode_json(read_file("$history_dir/$ymd/$hms_file"));
            $tmp->{_datetime} =~ /^([\d-]+)T([\d:]+)$/
                or die "Internal error: bad datetime '$tmp->{_datetime}'";
            $updates{$1}{$2} = $tmp;
        }
    }

    return \%updates;
}

############
#  tabled  #  Details of being tabled
############
sub tabled {
    my $self = shift;

    # A bill can be marked 'tabled' even if it's live, e.g. 2023-02-04
    # HM2 is marked "not prt tabled" but it's on the House Floor calendar
    # for 02-06 11:00. So, if we have a location, and it's scheduled,
    # assume it's live.
    if (my $l = $self->location) {
        if (my $t = str2time($l->datetime)) {
            return if $t > time - 86400;
        }
    }

    # No matter what nmlegis says, if a "T.pdf" file exists for the bill,
    # it has been tabled by the committee and no further updates are likely.
    # FIXME: okay, in theory it's possible for a bill to resurrect...?
    if (-d (my $billmirror = "$ENV{HOME}/.cache/nmlegis/mirror-bills/$YYYY")) {
        my $pattern = sprintf("%s%s%04d*T.[pP][dD][dF]",
                              map { $self->get($_) } qw(chamber type number));
        if (my @match = glob("$billmirror/$pattern")) {
            return basename($match[0]);
        }
    }

    if (my $history = $self->history) {
        if ($history->{tabled}) {
            return "tabled (no details)";
        }
    }

    return;
}

###########
#  votes  #
###########
sub votes {
    my $self = shift;
    my $my_bill_id = $self->name;

    my @votes;
    for my $tuple (NMLegis::Votes::committee_votes()) {
        my ($bill_id, $committee_id, $date, $legislator_id, $vote) = @$tuple;
        push @votes, [ $committee_id, $date, $legislator_id, $vote ]
            if $bill_id eq $my_bill_id;
    }

    @votes;
}

# END   complicated accessors
###############################################################################


1;


###############################################################################
#
# Documentation
#

=head1	NAME

FIXME - FIXME

=head1	SYNOPSIS

    use Fixme::FIXME;

    ....

=head1	DESCRIPTION

FIXME fixme fixme fixme

=head1	CONSTRUCTOR

FIXME-only if OO

=over 4

=item B<new>( FIXME-args )

FIXME FIXME describe constructor

=back

=head1	METHODS

FIXME document methods

=over 4

=item	B<method1>

...

=item	B<method2>

...

=back


=head1	EXPORTED FUNCTIONS

=head1	EXPORTED CONSTANTS

=head1	EXPORTABLE FUNCTIONS

=head1	FILES

=head1	SEE ALSO

L<Some::OtherModule>

=head1	AUTHOR

Ed Santiago <ed@edsantiago.com>

=cut
