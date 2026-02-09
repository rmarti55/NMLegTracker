# -*- perl -*-

package NMLegis::UI::Model::CommitteeReport;

use NMLegis::UI::Model::Committee;
use NMLegis::UI::Model::Legislator;

use strict;
use warnings;
use experimental qw(signatures);
use Carp;

###############################################################################
# It's just easier to define this as a global

our $DBIx;

###############################################################################
# BEGIN constructors called from DB

sub find($class, $dbix, @args) {
    $DBIx //= $dbix;

    my ($query, @bind, %backref);

    # One arg: just a bill (FIXME: can it be just a committee?)
    if (@args == 1) {
        ref($args[0]) =~ /::Bill/
            or croak "FATAL! CommitteeReport: was expecting a bill";
        $query = <<'END_SQL';
SELECT * FROM committee_reports WHERE billid=? ORDER BY date ASC, reportnum ASC
END_SQL
        @bind = ($args[0]->id);
        $backref{_bill} = $args[0];
    }

    # Two args: committee and bill
    elsif (@args >= 2) {
        $query = <<'END_SQL';
SELECT * FROM committee_reports
 WHERE committeeid=?
   AND billid=?
END_SQL

        my ($c_id, $b_id);
        for my $i (0, 1) {
            if (ref($args[$i])) {
                if (ref($args[$i]) =~ /::Committee/) {
                    # Special case for House, Senate
                    return if $args[$i]->_is_chamber;

                    if ($c_id) {
                        croak "FATAL! CommitteeReport: already have committee";
                    }
                    $c_id = $args[$i]->id;
                    $backref{_committee} = $args[$i];
                }
                elsif (ref($args[$i]) =~ /::Bill/) {
                    if ($b_id) {
                        croak "FATAL! CommitteeReport: already have bill";
                    }
                    $b_id = $args[$i]->id;
                    $backref{_bill} = $args[$i];
                }
            }
        }
        @bind = ($c_id, $b_id);
        if (grep { ! defined $_ } @bind) {
            croak "FATAL! bad args to CommitteeReport";
        }

        if (@args == 3) {
            $query .= " AND reportnum=?";
            push @bind, $args[2];
        }

        # In case we're called to get more than one
        $query .= " ORDER BY reportnum ASC";
    }

    croak "Could not make a query out of '@args'" if !$query;

    my @results = map { bless $_, $class } $DBIx->query($query, @bind)->hashes;

    if (keys %backref) {
        for my $result (@results) {
            while (my ($key, $val) = each %backref) {
                $result->{$key} = $val;
            }
        }
    }

    return @results;
}

# END   constructors called from DB
###############################################################################
# BEGIN custom accessors

sub bill ($self) {
    my $b = $self->{_bill}
        or die "FIXME no bill";
    return $b;
}

sub committee ($self) {
    if (! exists $self->{_committee}) {
        my @c = NMLegis::UI::Model::Committee->find($DBIx, $self->{committeeid});
        # Assume that this can never fail
        $self->{_committee} = $c[0];
    }
    return $self->{_committee};
}

sub votes ($self) {
    my @history = $DBIx->query(<<'END_SQL', $self->id)->hashes;
SELECT * FROM committee_report_votes WHERE reportid=?
END_SQL

    for my $h (@history) {
        my (@l) = NMLegis::UI::Model::Legislator->find($DBIx, $h->{legislatorid});
        $h->{legislator} = $l[0];
    }

    @history = sort { $a->{legislator}->lastname cmp $b->{legislator}->lastname } @history;
    return @history;
}

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

    carp "Undefined attr '$attr'"
        unless $attr =~ /^_/;           # e.g. is_chamber
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
