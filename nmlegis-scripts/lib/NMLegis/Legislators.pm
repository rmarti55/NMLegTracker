# -*- perl -*-
#
# NMLegis::Legislators - operations on legislators (people)
#
package NMLegis::Legislators;

use strict;
use warnings;

use Carp;
use File::Slurp;
use HTML::Entities;
use JSON::XS;
use Time::Piece;
use Unicode::Collate;

use NMLegis                     qw(:all);
use NMLegis::Bills;
use NMLegis::Committees;
use NMLegis::Scrape;
use NMLegis::Votes;

###############################################################################
# BEGIN user-configurable section

our $Legislators_File = "$Data_Dir/legislators.json";

# key = (H | S), then AREF indexed by district (which means there are gaps)
our %Legislators;

# Top-level list of legislators.
# **NOTE**: the key for House is 'R'(epresentative).
our $Legislator_List_URL = "$NMLEGIS/Members/Legislator_List?T=%s";

# Link to a web page for one individual legislator
our $Legislator_URL = "$NMLEGIS/Members/Legislator?SponCode=%s";

# END   user-configurable section
###############################################################################

# Program name of our caller
(our $ME = $0) =~ s|.*/||;

# RCS id, accessible to our caller via "$<this_package>::VERSION"
(our $VERSION = '$Revision: 0.0 $ ') =~ tr/[0-9].//cd;

# For non-OO exporting of code, symbols
our @ISA         = qw(Exporter);
our @EXPORT      = qw();
our @EXPORT_OK   = qw();
our %EXPORT_TAGS =   (all => \@EXPORT_OK);

###########
#  _init  #  load data file
###########
sub _init {
    return if keys(%Legislators);

    my $json = read_file($Legislators_File);
    my $tmp = decode_json($json);
    %Legislators = %$tmp;
}

#########
#  all  #  Return list of all legislators
#########
sub all {
    _init();

    my @list;
    for my $chamber (qw(H S)) {
        for my $l (@{$Legislators{$chamber}}) {
            if (defined $l) {
                # 2026-01 "office" is now "office room number" in HTML page
                # but we need to preserve the same name
                $l->{office} = $l->{"office room number"};

                push @list, bless $l, __PACKAGE__;
            }
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

    _init();

    my $self;
    if (@_ == 1) {
        my $arg = shift;
        if ($arg =~ /^(H|S)(\d+)$/i) {
            $self = $Legislators{uc $1}[$2]
                or croak "$ME: no match for chamber '$1' / district $2";
        }
        elsif ($arg =~ /^((H|S)[A-Z]{3,5})$/i) {
            my ($id, $chamber) = (uc($1), uc($2));

            my @match = grep { defined($_) && ($_->{id} eq $id) } @{$Legislators{$chamber}};
            croak "$ME: Internal error: multiple matches for $id in $chamber"
                if @match > 1;
            if (@match) {
                $self = $match[0];
            }
            else {
                carp "$ME: No match for legislator $id";
                # Return a dummy entry, so we can move on.
                # Seen 2024-01-10 with SNIBE
                $self = { id => $id,
                          party => '?',
                          chamber => $chamber,
                          district => 0,
                          name => "Unknown sponsor $id",
                      };
            }
        }
        else {
            croak "$ME: Cannot grok '$arg'";
        }
    }

    croak "$ME: no legislators match '@_'" if ! $self;

    return bless $self, $class;
}

#############
#  by_name  #  Find by last name (and initial, if present)
#############
sub by_name {
    my $proto = shift;
    my $class = ref($proto) || $proto;

    croak "Usage: ".__PACKAGE__."->by_name( [search terms] )"       if ! @_;

    my $chamber   = shift;
    my $lastname  = shift;
    my $firstname = shift;

    # Sometimes spelled Sedillo-Lopez, sometimes Sedillo Lopez
    $lastname =~ s/[ -]/[ -]/g;

    # Seen in 2025 HB1
    if ($lastname =~ /Marianna/) {
        $lastname = 'Anaya';
        $firstname = 'M';
    }
    # More 2025 special cases
    if ($lastname =~ /Garc.a/) {
        if ($firstname eq 'MP') {
            $firstname = 'Miguel';
        }
        elsif ($firstname eq 'M') {
            $firstname = 'Martha';
        }
    }

    my $collate = new Unicode::Collate::
        level         => 1,
        normalization => undef
        ;

    my @all = grep { $_->chamber eq $chamber } all();
    my @match = grep {
            $collate->eq($_->lastname, $lastname)
        } @all;
    if (@match > 1) {
        if ($firstname) {
            @match = grep { $_->firstname =~ /^$firstname/i } @match;
        }
    }
    if (@match == 1) {
        return $match[0];
    }
    if ($lastname =~ /\s/) {
        (my $re = $lastname) =~ s/\s+/.*/g;
        @match = grep { $collate->match($_->firstname . ' ' . $_->lastname, $lastname) } @all;
        if (@match == 1) {
                return $match[0];
        }
        use Data::Dump; dd "WEIRD: multiple matches legislator", \@match;
    }
    if (@match == 0) {
        $firstname //= '';
        warn "No match for $lastname $firstname in $chamber";
        return;
    }
    croak "Multiple matches for $lastname $firstname in $chamber";
    return;
}

###############################################################################
# BEGIN html fetch

################
#  fetch_html  #  key = (H|S) for list, <XXXXX> for one individual legislator
################
sub fetch_html {
    my $code = shift
        or croak "Usage: fetch_html( H | S | <legislator id> )";

    my $url;
    if ($code =~ /^(H|S)$/) {
        my $key = $code; $key = 'R' if $key eq 'H';
        $url = sprintf($Legislator_List_URL, $key);
    }
    elsif ($code =~ /^(H|S)[A-Z]{3,5}$/) {
        $url = sprintf($Legislator_URL, $code);
    }

    return NMLegis::Scrape->fetch($url);
}

# END   html fetch
###############################################################################
# BEGIN accessors

sub get {
    my $self = shift;
    my $attr = shift;

    # Direct lookup in hash
    if (exists $self->{$attr}) {
        return $self->{$attr};
    }

    # Mojo UI uses 'code' as identifier for everything
    return $self->{id} if $attr eq 'code';

    # Helper function (url, title)
    if (my $handler = $self->can($attr)) {
        return $handler->($self);
    }

    # 2025: ->office_phone() is actually 'office phone' with spaces.
    if ($attr =~ /_/) {
        (my $attr_with_spaces = $attr) =~ s/_/ /g;
        if (exists $self->{$attr_with_spaces}) {
            return $self->{$attr_with_spaces};
        }
    }

    # FIXME: don't croak if office/phone are undefined, like between sessions
    if ($attr eq 'office' || $attr eq 'phone') {
        # This is OK before session starts.
        warn "$ME: No $attr (yet?) for " . $self->name
            unless localtime->yday < 22;
        return '';
    }

    if ($attr eq 'chamber_name') {
        my $c = $self->{chamber} || '';
        return $NMLegis::Bills::Chamber{$c} || '??';
    }

    # Not everyone has a lead position
    # and phone/email are missing until first week
    carp "Undefined attr '$attr'"
        unless $attr eq 'lead_position'
        || $attr =~ /phone|email/;
    return '';
}

#########
#  url  #  autogenerated based on id
#########
sub url {
    my $self = shift;

    return sprintf($Legislator_URL, $self->{id});
}

#############
#  map_url  #  COOOOL! Akkana's district map, with highlights
#############
sub map_url {
    my $self = shift;

    sprintf("https://www.lwvnm.org/districtmaps/?map=NM_%s&show=%d", $self->chamber_name, $self->district);
}

###########
#  title  #  FIXME: can there ever be exceptions?
###########
sub title {
    my $self = shift;

    # FIXME: 2024-01-15: some code abbreviated %3.3s ("Spe" "Maj"). Ugh.
    # Speaker of the House, Majority Whip, etc
    #if (my $lead_position = $self->lead_position) {
    #return $lead_position;
    #}

    my %title = (H => 'Representative', S => 'Senator');
    return $title{ $self->chamber } || die "$ME: Internal error: no title";
}

###############
#  full_link  #  <a href="their page" title="party: district">name</a>
###############
sub full_link {
    my $self = shift;
    my $bill;                           # Optional arg: bill object

    my $name  = encode_entities($self->name);
    for my $arg (@_) {
        if ($arg eq 'last' || $arg eq 'lastname') {
            $name = encode_entities($self->lastname);
        }
        elsif ((ref($arg)||'') eq 'HASH') {
            if ($arg->{bill}) {
                $bill = delete $arg->{bill};
            }
            if (my @leftover = keys %$arg) {
                croak "$ME: ->full_link: cannot grok '@leftover'";
            }
        }
        else {
            croak "$ME: ->full_link(): Cannot grok '$arg'";
        }
    }

    my $title = sprintf("<a href=\"%s\" target=\"_blank\">%3.3s. %s</a> (%s)<br/>&nbsp;district %d",
                        $self->local_url,
                        $self->title,
                        encode_entities($self->name),
                        $self->party,
                        encode_entities($self->district));
    if (my $county = $self->county) {
        $title .= encode_entities(sprintf(", %s", $county));
    }

    my $party = $self->party;
    if ($bill) {
        my @cosponsors = $bill->sponsors;
        # Assume that we are the first sponsor
        if ($cosponsors[0]->id eq $self->id) {
            shift @cosponsors;                  # usual case
        }
        else {
            warn "$ME: WEIRD: $bill: $self->{id} != first sponsor";
        }

        if (@cosponsors) {
            $name .= sprintf(" <sup>+%d</sup>", scalar(@cosponsors));

            my $bipartisan = '';
            if (grep { $_->party ne $self->party } @cosponsors) {
                $bipartisan = 'Bipartisan ';
                $party = 'multi';
            }
            $title .= sprintf("<br/><hr/>with ${bipartisan}Cosponsor%s:<br/>",
                              scalar(@cosponsors) == 1 ? '' : 's');
            for my $s (@cosponsors) {
                $title .= sprintf(" - <a href=\"%s\" target=\"_blank\">%3.3s. %s</a>",
                                  $s->local_url,
                                  $s->title,
                                  encode_entities($s->name));
                $title .= sprintf(" (%s)", $s->party) if $bipartisan;
                $title .= "<br/>";
            }
        }

        # Generate a popup container showing cosponsors
        my $n = $bill->billno;
        return sprintf(<<"END_HTML", $name, $title);
<div class="popup-container">
<label class="popup-button popup--$party" for="spon-$n">%s</label>
<input type="checkbox" id="spon-$n">
<div class="popup">
<label for="spon-$n" class="transparent-label"></label>
	<div class="popup-inner">
        <div class="popup-title">
          <b>Sponsors: $n</b>
	<label for="spon-$n" class="popup-close-btn">X</label>
         </div>
	<div class="popup-content">
<p>%s</p>
	</div>
	</div>
	</div>
</div>
END_HTML
    }
    else {
        return sprintf("<label class=\"btn\">%s</label>",
                       $name);
    }
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

sub local_url {
    my $self = shift;

    return sprintf("/legislators/%s/%02d.html", lc($self->chamber), $self->district);
}


sub DESTROY {}

# END   accessors
###############################################################################
# BEGIN complicated accessors

sub committees {
    my $self = shift;

    return NMLegis::Committees::by_member($self);
}

sub on_committee {
    my $self = shift;
    my $want = shift;                   # in: Committee object

    for my $c ($self->committees) {
        if ($want->{abbr} eq $c->{abbr}) {
            return $c->{role};
        }
    }
    return;
}

sub sponsored_bills {
    my $self = shift;

    return NMLegis::Bills::sponsored_by($self);
}

sub committee_votes {
    my $self = shift;

    my $id = $self->id;

    my @votes;
    for my $tuple (NMLegis::Votes::committee_votes()) {
        my ($bill, $committee, $date, $legislator_id, $vote) = @$tuple;
        push @votes, [ $bill, $committee, $date, $vote ]
            if $legislator_id eq $id;
    }

    return @votes;
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
