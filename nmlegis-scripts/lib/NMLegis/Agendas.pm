# -*- perl -*-
#
# NMLegis::Agendas - operations on meeting agendas
#
package NMLegis::Agendas;

use strict;
use warnings;

use Carp;
use File::Slurp;
use HTML::Entities;
use JSON::XS;
use Time::Piece;

use NMLegis                     qw(:all);
use NMLegis::Committees;
use NMLegis::Legislators;

###############################################################################
# BEGIN user-configurable section

our $Schedule_File = "$Data_Dir/schedule.json";

our $Schedule;

our $JSON_Schema = '20230124';

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
#
# FIXME: change %Bills so it's keyed by session??
#
sub _init {
    # FIXME FIXME FIXME: 2025-03-10: this does not work well with UI; it
    # fails to detect changes. Find a better way to cache it.
#    return if keys(%$Schedule);

    my $json = read_file($Schedule_File);
    $Schedule = decode_json($json);

    my $schema = delete $Schedule->{_schema}
        or die "$ME: Internal error: no schema in $Schedule_File";
    $schema eq $JSON_Schema
        or die "$ME: FIXME: wrong schema '$schema' in $Schedule_File, expected $JSON_Schema";

    # Initialize inner fields
    for my $ymd (sort keys (%$Schedule)) {
        for my $hms (sort keys (%{$Schedule->{$ymd}})) {
            for my $cname (sort keys %{$Schedule->{$ymd}{$hms}}) {
                my $mtg = $Schedule->{$ymd}{$hms}{$cname};

                # "00:00" is a special case for "we don't know". Take it
                # to mean "right now".
                my $hms_updated = $hms;
                if ($hms !~ /[1-9]/) {
                    $hms_updated = localtime->hms;
                    # ...except, if it's "after floor session", the earliest
                    # it can be is noon.
                    if (($mtg->{time}||'') =~ /after.*floor/i) {
                        if (localtime->hour < 12) {
                            $hms_updated = "12:01:00";
                        }
                    }
                }

                $mtg->{ymd} = $ymd;
                ($mtg->{md} = $ymd) =~ s/^\d+-//;
                $mtg->{hms} = $hms_updated;
                ($mtg->{hm} = $hms_updated) =~ s/:\d+$//;
                $mtg->{cname} = $cname;

                # Cross-reference bills, to make it easy to query
                # where a bill is right now.
                # 2025-02-09 Use 'billh' for committees, but 'bills' for
                # Floor Calendars which don't seem to have reliable HTML.
                my $what = ($cname =~ /[a-z]/ ? 'bills' : 'billh');
                if (my $bills = $mtg->{$what}) {
                    for my $b (@$bills) {
                        if (my $found = $Schedule->{_bill_location}{$b}) {
                            my $do_warn = 1;

                            my $x1 = "@{$found}{'cname','md','hm'}";
                            my $x2 = $mtg->{hm};
                            for my $field (qw(md cname)) {
                                $x2 = "$mtg->{$field} $x2"
                                    if $mtg->{$field} ne $found->{$field};
                            }

                            # OK to have the same bill repeatedly on floor
                            if ($cname =~ /^(House|Senate)$/) {
                                if ($found->{cname} eq $cname) {
                                    $do_warn = 0;
                                }
                            }
                            # FIXME: also OK for it to move between days

                            my $keeping = "the first";
                            # If this found entry has an older mtime than the
                            # slot we're processing now, override it.
                            # FIXME: we need regression tests for this!
                            if ($found->{mtime} le $mtg->{mtime}) {
                                $keeping = "the second";
                                delete $Schedule->{_bill_location}{$b};

                                # OK if late in the day and new agendas
                                if ($found->{datetime} lt localtime->datetime) {
                                    $do_warn = 0;
                                }
                            }
                            warn "$ME: WARNING: Agendas.pm: $b found in $x1, $x2; keeping $keeping.\n"
                                if -t *STDIN && $do_warn;

                        }

                        $Schedule->{_bill_location}{$b} //= $mtg;
                    }
                }
            }
        }
    }
}

#########
#  all  #  Return list of all scheduled meetings
#########
sub all {
    my @list;

    _init();

    for my $ymd (sort grep { $_ !~ /^_/ } keys (%$Schedule)) {
        for my $hms (sort keys (%{$Schedule->{$ymd}})) {
            for my $cname (sort keys %{$Schedule->{$ymd}{$hms}}) {
                my $mtg = $Schedule->{$ymd}{$hms}{$cname};

                push @list, bless $mtg, __PACKAGE__;
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

    my $self;

    # FIXME: is there a need for this?
    ...;

    return bless $self, $class;
}

###############
#  find_bill  #  Find a bill, return agenda object
###############
sub find_bill {
    my $bill = shift;

    _init();

    my $billno = $bill->billno;
    if (my $mtg = $Schedule->{_bill_location}{$billno}) {
        return bless $mtg, __PACKAGE__;
    }

    return;
}

###############################################################################
# BEGIN accessors

sub get {
    my $self = shift;
    my $attr = shift;

    if (exists $self->{$attr}) {
        return $self->{$attr};
    }
    if (my $handler = $self->can($attr)) {
        return $handler->($self);
    }

    return;
    #croak "Undefined attr '$attr'";
}


sub room {
    my $self = shift;

    my $room = $self->{room} || '[could not determine room]';
    $room = "Room $room" unless $room =~ /Floor|determine/;

    return $room;
}

sub zoom_button {
    my $self = shift;

    my $z = $self->{zoom};
    if (! $z && $self->{cname} =~ /^(House|Senate)/) {
        # No sane way to scrape this
        $z = 'https://sg001-harmony.sliq.net/00293/harmony';
    }
    if ($z) {
        # 1F4F9 = video camera
        return sprintf("<a href=\"%s\" target=\"_blank\"><button><big>&#x1f4f9;</big></button></a>", $z);
    }

    return '';
}

sub committee {
    my $self = shift;

    $self->{_committee_obj} //= NMLegis::Committees->new($self->{cname});
}

sub time {
    my $self = shift;

    return $self->{time} || '[could not determine time]';
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
