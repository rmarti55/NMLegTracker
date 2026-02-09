# -*- perl -*-

package NMLegis::UI::Model::Committee;

use strict;
use warnings;
use experimental qw(signatures);
use Carp;

use NMLegis::Agendas;

###############################################################################
# It's just easier to define this as a global

our $DBIx;

###############################################################################
# BEGIN constructors called from DB

sub find($class, $dbix, @args) {
    $DBIx //= $dbix;

    if (! @args) {
        # all
        return map { bless $_, $class } $DBIx->query(<<'END_SQL')->hashes;
SELECT * FROM committees
    ORDER BY code ASC
END_SQL
    }

    my ($query, @bind);

    # One arg: committee code?
    if (@args == 1) {
        if ($args[0] =~ /^([SH][A-Z]{2,6})$/) {
            $query = 'SELECT * FROM committees WHERE code=? COLLATE NOCASE';
            @bind = ($1);
        }
        # internal ID
        elsif ($args[0] =~ /^(\d+)$/) {
            $query = 'SELECT * FROM committees WHERE id=?';
            @bind = ($1);
        }
        elsif ($args[0] =~ /^(House|Senate)$/) {
            my $name = ucfirst(lc($1));
            return bless {
                chamber => substr($name, 0, 1),
                name    => $name,
                code    => $name,
                _is_chamber => 1,
            }, $class;
        }
    }

    # Two args: treat as "field == value"
    if (@args == 2) {
        my ($field, $value) = @args;
        if (my $handler = __PACKAGE__->can("_find_by_$field")) {
            $query = $handler->();
            @bind = ($value);
        }
    }

    croak "Could not make a query out of '@args'" if !$query;

    return map { bless $_, $class } $DBIx->query($query, @bind)->hashes;
}

sub _find_by_legislatorid () {
    return <<'END_SQL';
SELECT * FROM committees c
         JOIN committee_members cm ON cm.committeeid == c.id
         WHERE cm.legislatorid == ?
END_SQL
}


# END   constructors called from DB
###############################################################################
# BEGIN custom accessors

sub shortname ($self) {
    my $shortname = $self->name;
    $shortname =~ s/^(House|Senate)\s+//;
    $shortname =~ s/\s+Committee\s*$//
        unless $shortname =~ /Committees.*\sCommittee/;

    # cache it
    return $self->{shortname} = $shortname;
}

sub members ($self) {
    return @{$self->{_members}} if exists $self->{_members};

    NMLegis::UI::Model::Legislator->find($DBIx, committeeid => $self->{id});
}

sub chair ($self) {
    my @members = $self->members
        or croak "committee $self->{code} has no members";

    my (@chair) = grep { $_->role =~ /^chair/i } @members
        or croak "committee $self->{code} has no chair";

    return $chair[0];
}

###############
#  schedules  #  List of meetings
###############
sub schedules ($self) {
    grep { $_->{cname} eq $self->code } NMLegis::Agendas::all();
}

#########
#  url  #  URL to page on THIS host
#########
sub url ($self) {
    if ($self->{_is_chamber}) {
        $self->{url} //= sprintf("/%s", $self->code);
    }
    else {
        $self->{url} //= sprintf("/committees/%s", $self->code);
    }

    $self->{url};
}

#################
#  nmlegis_url  #  URL to committee page on nmlegis.gov
#################
sub nmlegis_url ($self) {
    if ($self->_is_chamber) {
        $self->{nmlegis_url} //= sprintf("https://www.nmlegis.gov/Entity/%s/Floor_Calendar", $self->name);
    }
    else {
        $self->{nmlegis_url} //= sprintf("https://nmlegis.gov/Committee/Standing_Committee?CommitteeCode=%s", $self->code);
    }
}

sub vote_history ($self) {
    my @history;
    if ($self->_is_chamber) {
        my $YYYY = 2026;                # FIXME FIXME: hardcoded session!
        @history = $DBIx->query(<<'END_SQL', $self->chamber, $YYYY)->hashes;
SELECT * FROM floor_votes WHERE chamber=? AND session=?
END_SQL
    }
    else {
        @history = $DBIx->query(<<'END_SQL', $self->id)->hashes;
SELECT * FROM committee_reports cr
    JOIN committee_report_votes crv ON crv.reportid == cr.id
 WHERE cr.committeeid=?
END_SQL
    }

    # FIXME: massage? Sort?
    return @history;
}

#############
#  updates  #  Chronological history of updates as tracked on this system
#############
sub updates ($self) {
    # FIXME: implement some day
    return if $self->_is_chamber;

    my $sql = <<'END_SQL';
SELECT timestamp, event FROM committee_updates WHERE committeeid=?
    ORDER by timestamp ASC
END_SQL

    my @updates = $DBIx->query($sql, $self->id)->arrays;
    return @updates;
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
