# -*- perl -*-
#
# NMLegis::Committees - operations on committees
#
package NMLegis::Committees;

use strict;
use warnings;

use Carp;
use File::Slurp;
use JSON::XS;
use NMLegis                     qw(:all);
use NMLegis::Agendas;
use NMLegis::Legislators;
use NMLegis::Scrape;
use NMLegis::Votes;

###############################################################################
# BEGIN user-configurable section

our $Committees_File = "$Data_Dir/committees.json";

# key = ABBR, rest is an href
our %Committees;

# List of all committees
our $Committee_List_URL = "$NMLEGIS/Committee/Standing_Committees";

# Page for ONE committee
our $Committee_URL = "$NMLEGIS/Committee/Standing_Committee?CommitteeCode=%s";

# FIXME: interim is hard: their table links to committees by abbreviation (yay)
# and also by full name (boo); and even scraping the full-page name, I can't
# find an abbreviation (e.g. /Committee/Capitol_Buildings_Planning_Commission).
# Also, some links are /Entity (/Entity/LFC/Default) and don't have a table
# of members. Also, members can mix between House, Senate, Ex Officio, Public
our $Interim_URL = "$NMLEGIS/Committee/Interim";

# List of committee names and keywords. LHS is the abbreviation used on
# the web site, RHS is key words to search for in the PDFs. [Brackets]
# are words shared between multiple committees, so we can't use them
# as distinctive identifiers.
our $Committees = <<'END_COMMITTEES';
HAAWC   AA  Agriculture Acequias Water [Resources]
HAFC    AF  Appropriations Finance
HCEDC   CE  Commerce Economic [Development]
HCPAC   CP  Consumer [Public] [Affairs]
HEC     EC  Education
HENRC   EN  Energy Environment Natural [Resources]
HGEIC   GE  Government Elections Indian [Affairs]
HHHC    HC  Health Human Services
HJC     JC  Judiciary
HLVMC   LV  Labor Veterans Military [Affairs]
HXRC    X1  Rules Order Business
HRDLC   RD  Rural [Development] Land Grants Cultural [Affairs]
HTRC    TR  Taxation Revenue
HTPWC   TP  Transportation [Public] Works Capital Improvements
HXPSC   X2  Printing Supplies

SXCC    X3  Committees
SCONC   CO  Conservation
SEC     ED  Education
SFC     FC  Finance
SHPAC   PA  Health Public [Affairs]
SIRC    IC  Indian Rural Cultural [Affairs]
SJC     JU  Judiciary
SRC     RU  Rules
STBTC   CT  Tax Business Transportation
END_COMMITTEES

# Parse that
my %Committee_Name;
my %Committee_Two_Letter;
for my $line (split "\n", $Committees) {
    my ($name, $twoletter, @keywords) = split(' ', $line);
    next unless $name;

    $name =~ /^(H|S)/
        or croak "Internal error: committee '$name' is not H or S";
    my $chamber = $1;

    $Committee_Two_Letter{$name} = $twoletter;
    $Committee_Two_Letter{$twoletter} = $name;

    for my $k (grep { $_ !~ /\[/ } @keywords) {
        if (exists $Committee_Name{$chamber}{uc $k}) {
            croak "Internal error: '$k' found in $Committee_Name{$chamber}{uc $k} and $name";
        }
        $Committee_Name{$chamber}{uc $k} = $name;
    }
}

# END   user-configurable section
###############################################################################

# Program name of our caller
(our $ME = $0) =~ s|.*/||;

# RCS id, accessible to our caller via "$<this_package>::VERSION"
(our $VERSION = '$Revision: 0.0 $ ') =~ tr/[0-9].//cd;

# For non-OO exporting of code, symbols
our @ISA         = qw(Exporter);
our @EXPORT      = qw();
our @EXPORT_OK   = qw(committee_code_from_name);
our %EXPORT_TAGS =   (all => \@EXPORT_OK);

###########
#  _init  #  load data file
###########
sub _init {
    return if keys(%Committees);

    my $json = read_file($Committees_File);
    my $tmp = decode_json($json);
    %Committees = %$tmp;
}

#########
#  all  #  Return list of all committees
#########
sub all {
    _init();

    my @list;
    for my $abbr (sort grep { $_ !~ /^_/ } keys %Committees) {
        push @list, bless $Committees{$abbr}, __PACKAGE__;
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
        my $arg = $_[0];
        if ($arg =~ /^(House|Senate)$/i) {
            my $name = ucfirst(lc($1));
            $self = {
                abbr => $name,
                name => $name,
                url  => "$NMLEGIS/Entity/$name/Floor_Calendar",
            };
        }
        elsif ($arg =~ /^((H|S)([A-Z0-9]{2,5}))$/i) {
            my $cname = uc($1);
            $cname = 'SXCC' if $cname eq 'SCC';         # Committee's Committee
            $cname = 'HXRC' if $cname eq 'HRC';         # House Rules

            $self = $Committees{$cname}
                or croak "$ME: no match for committee '$cname'";
        }
        # E.g., 2022-02-13 for SFCSJC joint meeting
        #                12   23             3145   5             4
        elsif ($arg =~ /^((H|S)([A-Z0-9]{2,5}))((H|S)[A-Z0-9]{2,5})$/i) {
            my (@names) = ($1, $4);
            ...
        }
        # Two-letter codes used in committee reports, eg SB0003HC1
        elsif ($arg =~ /^([A-Z]{2})$/) {
            if (my $cname = $Committee_Two_Letter{$1}) {
                $self = $Committees{$cname}
                    or croak "$ME: internal error: $arg -> $cname -> ???";
            }
            else {
                carp "Weird: No committee mapping for 2-letter '$arg'";
                return;
            }
        }
        else {
            croak "$ME: Cannot grok '$arg'";
        }
    }

    croak "$ME: no committees match '@_'" if ! $self;

    return bless $self, $class;
}

###############
#  by_member  #  list of committees with ARG as member
###############
sub by_member {
    my $l    = shift;                   # in: legislator...
    # ...make it an object if not already so
    if (! ref($l)) {
        $l = NMLegis::Legislator->new($l);
    }

    _init();

    my @list;
    for my $abbr (sort keys %Committees) {
        next if $abbr =~ /^_/;                  # schema

        my $c = $Committees{$abbr};
        if (my $members = $c->{members}) {
            for my $m (@$members) {
                if ($m->{code} eq $l->id) {
                    $c->{role} = $m->{role};
                    push @list, bless $c, __PACKAGE__;
                }
            }
        }
    }


    return @list;
}

##############################
#  committee_code_from_name  #  Given FOO BAR COMMITTEE, return short code
##############################
sub committee_code_from_name {
    my $chamber = shift;
    my $name    = shift;

    # Remove trailing apostrophe from COMMITTEES' COMMITTEE
    my @keywords = map { s/'$//; $_; } split(' ', $name);
    shift(@keywords) if $keywords[0] =~ /^(HOUSE|SENATE)$/;
    pop(@keywords)   if $keywords[-1] eq 'COMMITTEE';

    my %match = map { ($Committee_Name{$chamber}{$_}||'') => 1 } @keywords;
    delete $match{''};
    my @match = sort keys(%match);
    if (@match == 0) {
        die "$ME: No committee-name match for '$name'\n";
    }
    elsif (@match > 1) {
        my $matches = join(', ', @match);
        die "$ME: Multiple committee-name matches for '$name': $matches\n";
    }

    return $match[0];
}

###############################################################################
# BEGIN html fetch

################
#  fetch_html  #  arg = nul for main list, committee code for just that committe
################
sub fetch_html {
    my $code = shift;

    my $url;
    if (! $code) {
        $url = $Committee_List_URL;
    }
    elsif ($code =~ /^(H|S)[A-Z0-9]{2,5}$/) {
        $url = sprintf($Committee_URL, $code);
    }
    else {
        croak "$ME: invalid arg '$code'";
    }

    return NMLegis::Scrape->fetch($url);
}

# END   html fetch
###############################################################################
# BEGIN accessors

sub get {
    my $self = shift;
    my $attr = shift;

    # Mojo UI uses 'code' as identifier for everything
    return $self->{abbr} if $attr eq 'code';

    if (exists $self->{$attr}) {
        return $self->{$attr};
    }
    if (my $handler = $self->can($attr)) {
        return $handler->($self);
    }

    carp "$ME: No '$attr'"   unless $attr =~ /^(room|time)/i;
    return;
    #croak "Undefined attr '$attr'";
}

###############
#  shortname  #  with chamber and "committee" removed
###############
sub shortname {
    my $self = shift;

    my $shortname = $self->name;
    $shortname =~ s/^(House|Senate)\s+//;
    $shortname =~ s/\s+Committee\s*$//
        unless $shortname =~ /Committees.*\sCommittee/;

    return $shortname;
}

#########
#  url  #  autogenerated based on id
#########
sub url {
    my $self = shift;

    return $self->{url} || sprintf($Committee_URL, $self->{abbr});
}

sub local_url {
    my $self = shift;

    return sprintf("/committees/%s/", $self->abbr);
}

sub room {
    my $self = shift;

    if ($self->{name} =~ /^(House|Senate)$/) {
        return "$self->{name} Floor";
    }
    my $room = $self->{room} || return '';
    return "Room $room";
}

#############
#  members  #  list of ::Legislator objects
#############
sub members {
    my $self = shift;

    my $members = $self->{members}
        or croak "$ME: committee $self->{abbr} has no members";

    # Can't do a simple map(), because we need to preserve role
    my @members;
    for my $m (@$members) {
        my $m_obj = NMLegis::Legislators->new( $m->{code} );
        $m_obj->{role} = $m->{role};
        push @members, $m_obj;
    }
    return @members;
}

###########
#  chair  #  one ::Legislator object
###########
sub chair {
    my $self = shift;

    my $members = $self->{members}
        or croak "$ME: committee $self->{abbr} has no members";

    my (@chair) = grep { $_->{role} =~ /^chair/i } @$members
        or croak "$ME: committee $self->{abbr} has no chair";

    return NMLegis::Legislators->new( $chair[0]->{code} );
}

###########
#  votes  #
###########
sub votes {
    my $self = shift;
    my $abbr = $self->abbr;

    my @votes;
    for my $tuple (NMLegis::Votes::committee_votes()) {
        my ($bill, $committee_id, $date, $legislator_id, $vote) = @$tuple;
        push @votes, [ $bill, $date, $legislator_id, $vote ]
            if $committee_id eq $abbr;
    }

    @votes;
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

###############
#  schedules  #  Returns list of Agenda objects
###############
sub schedules {
    my $self = shift;
    my $abbr = $self->abbr;

    return grep { $_->{cname} eq $abbr } NMLegis::Agendas::all();
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
