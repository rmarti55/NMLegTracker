# -*- perl -*-

package NMLegis::UI::Model::Hearing;

use strict;
use warnings;
use experimental qw(signatures);
use Carp;

use NMLegis                             qw($Data_Dir);
use NMLegis::UI::Model::Bill;
use Date::Parse;
use File::Slurp;
use JSON::XS;
use Time::Piece;

###############################################################################
# BEGIN constructors called from DB

sub all($class) {
    # FIXME: refactor this so we only read once?
    my $schedule_all = read_json("schedule.json");
    delete $schedule_all->{_schema};

    for my $ymd (sort keys %$schedule_all) {
        for my $hms (sort keys %{$schedule_all->{$ymd}}) {
            bless $schedule_all->{$ymd}{$hms}, $class;
        }
    }

    return $schedule_all;
}

sub find ($class, $dbix, @args) {
    my $all = all($class);

    if (! @args) {
        return $all;
    }

    if (@args == 1) {
        if ($args[0] =~ /^((H|S)[A-Za-z]+)$/) {
            my $committeecode = $1;

            # Delete all that are not ours
            for my $ymd (keys %$all) {
                for my $hms (keys %{$all->{$ymd}}) {
                    for my $k (keys %{$all->{$ymd}{$hms}}) {
                        delete $all->{$ymd}{$hms}{$k}
                            unless $k eq $committeecode;
                    }

                    delete $all->{$ymd}{$hms}
                        if ! keys %{$all->{$ymd}{$hms}};
                }
                delete $all->{$ymd}
                    if ! keys %{$all->{$ymd}};
            }

            return $all;
        }
    }

    if (@args == 2) {
        if ($args[0] eq 'tracker') {
            my $t = $args[1];

            my @watched = $t->bill_list;
            my %watched;
            for my $tuple (@watched) {
                for my $b (1 .. $#{$tuple}) {
                    $watched{$tuple->[$b]->code}++;
                }
            }

            # Make a copy, including only the hearings in which we're hearing
            my %copy;
            for my $ymd (keys %$all) {
                for my $hms (keys %{$all->{$ymd}}) {
                    for my $k (keys %{$all->{$ymd}{$hms}}) {
                        my $mtg = $all->{$ymd}{$hms}{$k};
                        my $bref = $mtg->{billh} || $mtg->{bills};

                        # For a tracker list, don't show full agendas.
                        my @watched;
                        my $sequence = 0;
                        for my $billcode (@$bref) {
                            ++$sequence;
                            if ($watched{$billcode}) {
                                push @watched, NMLegis::UI::Model::Bill->find($dbix, $billcode);
                                $watched[-1]{sequence} = $sequence;
                            }
                        }
                        if (@watched) {
                            $mtg->{billh} = $mtg->{bills} = \@watched;
                            $copy{$ymd}{$hms}{$k} = $mtg;
                        }
                    }
                }
            }
            return \%copy;
        }
    }

    carp "Could not find hearings for '@args'";
}

sub read_json($file) {
    my $json = read_file("$Data_Dir/$file");
    return decode_json($json);
}

# END   constructors called from DB
###############################################################################
# BEGIN custom accessors

# END   custom accessors
###############################################################################
# BEGIN standard accessors

sub get ($self, $attr) {
    if (exists $self->{$attr}) {
        return $self->{$attr};
    }
    if (my $handler = $self->can($attr)) {
        return $handler->($self);
    }

    warn "Undefined attr '$attr'";
    return;
}

use vars qw($AUTOLOAD);
sub AUTOLOAD {
    my $self = shift;

    (my $attr = $AUTOLOAD) =~ s/^.*:://;
    $self->get($attr);
}

sub DESTROY {}

# END   standard accessors
###############################################################################

1;
