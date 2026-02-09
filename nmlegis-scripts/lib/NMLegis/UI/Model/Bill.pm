# -*- perl -*-

package NMLegis::UI::Model::Bill;

use strict;
use warnings;
use experimental qw(signatures);

use Carp;
use NMLegis::UI::Model::CommitteeReport;
use NMLegis::UI::Model::Legislator;
use NMLegis::UI::Model::Tracker;

use Date::Parse;
use NMLegis                     qw(:all);
use NMLegis::Agendas;
use NMLegis::Bills;             # FIXME: hope that some day we can wean off
use Time::Piece;

###############################################################################
# It's just easier to define this as a global

our $DBIx;

###############################################################################
# BEGIN constructors called from DB

sub find($class, $dbix, @args) {
    $DBIx //= $dbix;

    my $query;
    my @bind = ($YYYY);         # FIXME! Determine $Session!

    if (! @args) {
        # all
        $query = <<'END_SQL';
SELECT * FROM bills WHERE session=?
    ORDER BY chamber ASC, type ASC, number ASC
END_SQL
    }

    # One arg
    if (@args == 1) {
        # Already a bill object?
        if ((ref($args[0])||'') eq $class) {
            return $args[0];
        }

        if ($args[0] eq 'signed') {
            $query = <<'END_SQL';
SELECT * FROM bills WHERE session=? AND actions LIKE '%SGND%'
    ORDER BY chamber ASC, type ASC, number ASC
END_SQL
        }

        if ($args[0] eq 'vetoed') {
            $query = <<'END_SQL';
SELECT * FROM bills WHERE session=? AND actions LIKE '%VETO%'
    ORDER BY chamber ASC, type ASC, number ASC
END_SQL
        }

        elsif ($args[0] eq 'pending') {
            $query = <<'END_SQL';
SELECT * FROM bills
  WHERE session=?
    AND actions LIKE "%PASSED/H%"
    AND actions LIKE "%PASSED/S%"
    AND actions NOT LIKE "%SGND%"
  ORDER BY chamber ASC, type ASC, number ASC
END_SQL
        }

        # Bill ID
        elsif ($args[0] =~ /^([SH][A-Z]{1,6}\d+)$/i) {
            $query = 'SELECT * FROM bills WHERE session=? AND code=? COLLATE NOCASE';
            push @bind, uc $1;
        }
        elsif ($args[0] =~ /^(\d+)$/) {
            $query = 'SELECT * FROM bills WHERE session=? AND id=?';
            push @bind, $1;
        }
    }

    # Two args: treat as "field == value"
    if (@args == 2) {
        my ($field, $value) = @args;
        if (my $handler = __PACKAGE__->can("_find_by_$field")) {
            ($query, @bind) = $handler->($value);
        }
    }

    if (!$query) {
        carp "cannot find bill matching '@args'";
        return;
    }

    return map { bless $_, $class } $DBIx->query($query, @bind)->hashes;
}

sub _find_by_billid ($bind) {
    return ('SELECT * FROM bills WHERE id=?', $bind);
}

sub _find_by_filed ($bind) {
    return (<<'END_SQL', $bind);
SELECT * FROM bills b JOIN bill_updates bu ON bu.billid == b.id
    WHERE bu.event LIKE 'filed%'
    AND timestamp > (SELECT unixepoch() - ? * 86400)
    ORDER BY (SELECT strftime("%Y-%m-%d", bu.timestamp)) DESC, chamber ASC, type ASC, number ASC
END_SQL
}

sub _find_by_halfpassed ($chamber) {
    my $c = substr($chamber, 0, 1);
    my $notc = ($c eq 'H' ? 'S' : 'H');
    return (<<'END_SQL', "%PASSED/$c %", "%PASSED/$notc %");
SELECT * FROM bills
 WHERE actions LIKE ?
   AND actions NOT LIKE ?
   AND actions NOT LIKE '%SGND%'
 ORDER BY chamber ASC, type ASC, number ASC
END_SQL
}

# END   constructors called from DB
###############################################################################
# BEGIN custom accessors

sub chamber_name ($self) {
    my %name = (H => 'House', S => 'Senate');
    $self->{chamber_name} = $name{ $self->chamber };
}

sub type_name ($self) {
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
        or croak "Internal error: unknown type '$type' for $self";
    return $name . $map{$type};
}

sub yy ($self) {
    # FIXME: how do we handle special sessions?
    (my $yy = $self->session) =~ s/^20//;
    return $yy;
}

# All sponsors
sub sponsors ($self) {
    $self->{_sponsors} //= do {
        my @s = NMLegis::UI::Model::Legislator->find($DBIx, billsponsor => $self->{id});
        \@s;
    };
    @{ $self->{_sponsors} };
}
# Just the first one
sub sponsor ($self) {
    my @sponsors = $self->sponsors;
    $sponsors[0];
}

sub name ($self) {
    $self->{name} //= $self->code;
}
sub billno ($self) {
    $self->{billno} //= $self->code;
}

sub location ($self) {
    $self->{location} //= NMLegis::Agendas::find_bill($self);
}

sub url ($self) {
    $self->{url} //= "/bills/" . $self->code;
}

sub nmlegis_url ($self) {
    return NMLegis::Bills::url($self);
}

#####################
#  nmlegis_doc_url  #  where nmlegis stores bill and report PDFs/HTMLs
#####################
sub nmlegis_doc_url ($self, $doc) {
    # e.g. /Sessions/25 Regular/bills/senate/
    my $base = "https://nmlegis.gov/Sessions";

    $base .= sprintf("/%02d%%20Regular", $self->session % 100);

    # FIXME: have I missed any?
    my %typemap = (
        B  => 'bills',
        M  => 'memorials',
        JM => 'memorials',
        R  => 'resolutions',
        CR => 'resolutions',
        JR => 'resolutions',
    );
    $base .= "/" . $typemap{$self->type};
    $base .= "/" . lc($self->chamber_name);
    $base .= "/" . $doc;

    return $base;
}

############
#  tabled  #  Details of being tabled
############
sub tabled ($self) {
    # A bill can be marked 'tabled' even if it's live, e.g. 2023-02-04
    # HM2 is marked "not prt tabled" but it's on the House Floor calendar
    # for 02-06 11:00. So, if we have a location, and it's scheduled,
    # assume it's live.
    if (my $l = $self->location) {
        my $t = str2time($l->datetime);
        return if $t > time - 86400;
    }

    # No matter what nmlegis says, if a "T.pdf" file exists for the bill,
    # it has been tabled by the committee and no further updates are likely.
    # FIXME: okay, in theory it's possible for a bill to resurrect...?
    if (-d (my $billmirror = "$ENV{HOME}/.cache/nmlegis/mirror-bills/$YYYY")) {
        my $pattern = sprintf("%s%s%04d*T.[pP][dD][dF]",
                              map { $self->get($_) } qw(chamber type number));
        if (my @match = glob("$billmirror/$pattern")) {
            (my $filebase = $match[0]) =~ s!^.*/!!;
            return $filebase;
        }
    }

    if (my $history = $self->history) {
        if ($history->{tabled}) {
            return "tabled (no details)";
        }
    }

    return;
}

#############
#  actions  #  Normally the XX-YY/ZZ string, but may include user overrides
#############
sub actions ($self) {
    my $actions = $self->{actions} || '???';
    if (my $update = $self->user_report) {
        $DBIx->query('SELECT firstname FROM users WHERE id=?',
                                     $update->{userid})->into(my $firstname);
        $actions .= " [99<$update->{timestamp}:$firstname>] $update->{action}";
    }

    return $actions;
}

#################
#  user_report  #  Is there a user update about this bill?
#################
sub user_report ($self, $userid = 0, $action = '') {
    if ($userid && $action) {
        $userid =~ /^\d+$/
            or croak "user_report: invalid userid '$userid'";

        my $t = time;
        if ($action eq '-') {
            $DBIx->query('DELETE FROM bill_user_reports WHERE billid=?',
                         $self->id);
            $action = "remove prior user report";
        }
        else {
            $DBIx->query('INSERT INTO bill_user_reports VALUES (??)',
                         $t, $self->id, $userid, $action);
        }
        $DBIx->query('INSERT INTO bill_updates VALUES (??)',
                     $t, $self->id, "user report:$userid:$action");
    }

    else {
        # get
        my @ur = $DBIx->query('SELECT * FROM bill_user_reports WHERE billid=?',
                              $self->id)->hashes;
        # There can only be one report
        return $ur[0];
    }
}


#################
#  css_classes  #  FIXME FIXME FIXME, this is not the right place for this
#################
sub css_classes ($self) {
    my @classes;

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

#############
#  updates  #  Chronological history of updates as tracked on this system
#############
sub updates ($self) {
    my $sql = <<'END_SQL';
SELECT timestamp, event FROM bill_updates WHERE billid=?
    ORDER by timestamp ASC
END_SQL

    my @updates = $DBIx->query($sql, $self->id)->arrays;
    return @updates;
}

######################
#  committee_report  #  Committee report for a given bill, committee, and pass
######################
sub committee_report ($self, $committee, $iteration = 1) {
    my @x = NMLegis::UI::Model::CommitteeReport->find($DBIx, $self, $committee, $iteration);

    return $x[0];
}

sub committee_reports ($self) {
    return NMLegis::UI::Model::CommitteeReport->find($DBIx, $self);
}

sub floor_votes ($self, $chamber) {
    my @votes = $DBIx->query(<<'END_SQL', $self->id, substr($chamber,0,1))->hashes;
SELECT * FROM floor_votes WHERE billid=? AND chamber=?
END_SQL

    ($_->{legislator}) = NMLegis::UI::Model::Legislator->find($DBIx, $_->{legislatorid})
        for @votes;

    return @votes;
}

###########
#  votes  #  by committee or chamber floor
###########
sub votes ($self, $committee) {
    my @votes;

    warn "\n\nBill->votes() is going away!\n\n\n";

    ref($committee)
        or do {
            carp "Called Bill->votes() with unknown arg '$committee'";
            return;
        };

    if ($committee->code =~ /^(H|S)[a-z]+$/) {
        @votes = $DBIx->query(<<'END_SQL', $self->id, $1)->hashes;
SELECT * FROM floor_votes WHERE billid=? AND chamber=?
END_SQL
    }
    else {
        @votes = $DBIx->query(<<'END_SQL', $self->id, $committee->id)->hashes;
SELECT * FROM committee_votes WHERE billid=? AND committeeid=?
END_SQL
    }

    return @votes;
}

########
#  cs  #  Committee Substitution. Returns list of { committeeid, sub }
########
sub cs ($self) {
    my @reports = $DBIx->query(<<'END_SQL', $self->id)->hashes;
SELECT committeeid, cs FROM committee_reports
 WHERE billid=?
   AND cs IS NOT NULL
  ORDER BY date ASC
END_SQL

    # FIXME: objectify committees
    return @reports;
}

################
#  tracked_by  #  list of trackers which include this bill
################
sub tracked_by ($self) {
    # FIXME: if called with user arg, see if user has access
    #   JOIN tracker_access ta ON ta.trackerid==t.id

    my @tracked_by = $DBIx->query(<<'END_SQL', $self->id)->flat;
SELECT t.id FROM trackers t
            JOIN tracked ON tracked.trackerid==t.id
 WHERE t.is_public==1
   AND tracked.billid==?
END_SQL

    return map { NMLegis::UI::Model::Tracker->find($DBIx, $_) } @tracked_by;
}

# END   custom accessors
###############################################################################
# BEGIN kludgy redirects to original code

sub history             ($self) { NMLegis::Bills::history($self); }
sub html_progress_table ($self, @highlight) {
    my @rows = NMLegis::Bills::html_progress_table($self, @highlight);

    return @rows;
}

################################
#  financial_report_available  #  for showing green dollar sign
################################
sub financial_report_available ($self) {
    $self->fir || $self->lescanalysis || $self->lfcform;
}
sub fir ($self)          { NMLegis::Bills::_find_analysis($self, 'firs'); }
sub lescanalysis ($self) { NMLegis::Bills::_find_analysis($self, 'LESCAnalysis'); }
sub lfcform ($self)      { NMLegis::Bills::_find_analysis($self, 'LFCForms'); }

sub _load ($self)        { }

# END   kludgy redirects to original code
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
    return if $attr eq 'DESTROY';
    $self->get($attr);
}

# END   accessors
###############################################################################

1;
