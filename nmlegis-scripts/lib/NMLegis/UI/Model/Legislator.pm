# -*- perl -*-

package NMLegis::UI::Model::Legislator;

use strict;
use warnings;
use experimental qw(signatures);

use Carp;
use NMLegis::UI::Model::Bill;
use NMLegis::UI::Model::Committee;
use NMLegis::UI::Model::Legislator;

###############################################################################
# It's just easier to define this as a global

our $DBIx;

###############################################################################
# BEGIN constructors called from DB

sub find($class, $dbix, @args) {
    $DBIx //= $dbix;

    my ($query, @bind);

    if (! @args) {
        # all
        $query = <<'END_SQL';
SELECT * FROM legislators
    ORDER BY chamber ASC, district ASC
END_SQL
    }

    # One arg: legislator ID, or perhaps 'H' or 'S' for a list
    if (@args == 1) {
        if ($args[0] =~ /^(H|S)$/i) {
            # This returns a LIST
            @bind = (uc $1);
            $query = 'SELECT * FROM legislators WHERE chamber=?';
        }
        elsif ($args[0] =~ /^(H(ouse)?|S(enate)?)\s*(\d+)$/i) {
            @bind = (uc(substr($1, 0, 1)), $4);
            $query = 'SELECT * FROM legislators WHERE chamber=? AND district=?';
        }
        elsif ($args[0] =~ /^([SH][A-Z]{2,6})$/) {
            $query = 'SELECT * FROM legislators WHERE code=? COLLATE NOCASE';
            @bind = ($1);
        }
        elsif ($args[0] =~ /^(\d+)$/) {
            @bind = ($1);
            $query = 'SELECT * FROM legislators WHERE id=?';
        }
    }

    # Two args: treat as "field == value"
    if (@args == 2) {
        my ($field, $value) = @args;

        if (my $handler = __PACKAGE__->can("_find_by_$field")) {
            $query = $handler->();
            @bind = ($value);
        }
        elsif ($field =~ /^(H|S)/i && $value =~ /^(\d+)$/) {
            $query = 'SELECT * FROM legislators WHERE chamber=? AND district=?';
            @bind = (uc(substr($field,0,1)), $value);
        }

        croak "Could not make a query out of '$field = $value'" if !$query;
    }


    croak "cannot find legislator matching '@args'" if !$query;

    return map { bless $_, $class } $DBIx->query($query, @bind)->hashes;
}

sub _find_by_committeeid () {
    return <<'END_SQL';
SELECT * FROM legislators l
         JOIN committee_members cm ON cm.legislatorid == l.id
         WHERE cm.committeeid == ?
         ORDER BY CASE
           WHEN cm.role = "Chair"          THEN 0
           WHEN cm.role = "Vice Chair"     THEN 1
           WHEN cm.role = "Ranking Member" THEN 2
           WHEN cm.role = "Ranking Member" THEN 3
           WHEN cm.role = "Member"         THEN 4
                                           ELSE 5
         END, l.lastname
END_SQL
}

sub _find_by_billsponsor () {
    return <<'END_SQL';
SELECT * FROM legislators l
         JOIN sponsors s ON s.legislatorid == l.id
         WHERE s.billid == ?
         ORDER BY sequence
END_SQL
}

# END   constructors called from DB
###############################################################################
# BEGIN custom accessors

sub name ($self) {
    return $self->firstname . " " . $self->lastname;
}

###########
#  title  #  FIXME: can there ever be exceptions?
###########
sub title ($self) {
    # FIXME: 2024-01-15: some code abbreviated %3.3s ("Spe" "Maj"). Ugh.
    # Speaker of the House, Majority Whip, etc
    #if (my $lead_position = $self->lead_position) {
    #return $lead_position;
    #}

    my %title = (H => 'Representative', S => 'Senator');
    return $title{ $self->chamber }
        || croak "No title for $self";
}

sub title_and_name ($self) {
    sprintf("%3.3s. %s", $self->title, $self->name);
}

sub committees ($self) {
    NMLegis::UI::Model::Committee->find($DBIx, legislatorid => $self->{id});
}

sub chamber_name ($self) {
    my %name = (H => 'House', S => 'Senate');
    $self->{chamber_name} = $name{ $self->chamber };
}

sub url ($self) {
    $self->{url} = sprintf("/legislators/%s", $self->code);
}

#################
#  nmlegis_url  #  URL to nmlegis.gov
#################
sub nmlegis_url ($self) {
    $self->{nmlegis_url} //= sprintf("https://nmlegis.gov/Members/Legislator?SponCode=%s", $self->code);
}

#############
#  map_url  #  COOOOL! Akkana's district map, with highlights
#############
sub map_url ($self) {
    sprintf("https://www.lwvnm.org/districtmaps/?map=NM_%s&show=%d", $self->chamber_name, $self->district);
}

######################
#  bills_introduced  #  Where this is the primary sponsor
######################
sub bills_introduced ($self) {
    # FIXME: hardcoded session
    my @bills = map { NMLegis::UI::Model::Bill->find($DBIx, $_) } $DBIx->query(<<'END_SQL', $self->id, 2026)->flat;
SELECT b.id FROM bills b JOIN sponsors s ON s.billid == b.id
 WHERE s.legislatorid=?
   AND b.session == ?
   AND s.sequence == 1
 ORDER BY b.chamber ASC, b.type ASC, b.number ASC
END_SQL

    return @bills;
}

#######################
#  bills_cosponsored  #  Where this is NOT the primary sponsor
#######################
sub bills_cosponsored ($self) {
    # FIXME: hardcoded session
    my @bills = map { NMLegis::UI::Model::Bill->find($DBIx, $_) } $DBIx->query(<<'END_SQL', $self->id, 2026)->flat;
SELECT b.id FROM bills b JOIN sponsors s ON s.billid == b.id
 WHERE s.legislatorid=?
   AND b.session  == ?
   AND s.sequence != 1
 ORDER BY b.chamber ASC, b.type ASC, b.number ASC
END_SQL

    return @bills;
}

sub committee_vote_history ($self) {
    # FIXME: hardcoded session
    my @history = $DBIx->query(<<'END_SQL', $self->id, 2026)->hashes;
SELECT cr.committeeid AS committeeid,
       cr.billid      AS billid,
       cr.reportnum   AS reportnum,
       cr.date        AS date,
       crv.vote       AS vote
    FROM committee_reports cr
    JOIN committee_report_votes crv ON crv.reportid == cr.id
    WHERE crv.legislatorid=?
      AND cr.session == ?
    ORDER BY date ASC, reportnum ASC
END_SQL

    for my $h (@history) {
        my @x = NMLegis::UI::Model::Bill->find($DBIx, $h->{billid});
        $h->{bill}      = $x[0];
        @x = NMLegis::UI::Model::Committee->find($DBIx, $h->{committeeid});
        $h->{committee} = $x[0];
    }

    return @history;
}

#############
#  updates  #  Chronological history of updates as tracked on this system
#############
sub updates ($self) {
    my $sql = <<'END_SQL';
SELECT timestamp, event FROM legislator_updates WHERE legislatorid=?
    ORDER by timestamp ASC
END_SQL

    my @updates = $DBIx->query($sql, $self->id)->arrays;
    return @updates;
}

# END   custom accessors
###############################################################################
# BEGIN standard accessors

sub get ($self, $attr) {
    # Handle 'office phone', etc
    $attr =~ s/\s+/_/g;

    if (exists $self->{$attr}) {
        return $self->{$attr};
    }
    if (my $handler = $self->can($attr)) {
        return $handler->($self);
    }

    warn "Undefined attr '$attr'"
        unless $attr =~ /phone|email/;  # Often null before first week
    return;
}

use vars qw($AUTOLOAD);
sub AUTOLOAD {
    my $self = shift;

    (my $attr = $AUTOLOAD) =~ s/^.*:://;
    $self->get($attr);
}

sub DESTROY {}

# END   accessors
###############################################################################

1;
