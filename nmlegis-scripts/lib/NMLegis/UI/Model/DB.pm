# -*- perl -*-

package NMLegis::UI::Model::DB;

use v5.30;

use DBIx::Simple;
use DBD::SQLite::Constants      qw(:dbd_sqlite_string_mode);

# Override allows for testing and debugging
# FIXME: hardcoded path
our $DbFile = $ENV{NMLEGIS_UI_TEST_DB}
    || '/home/esm/src/nmlegis/db/nmlegis.sqlite';

use strict;
use warnings;
use experimental qw(signatures);

use NMLegis::UI::Model::Legislator;
use NMLegis::UI::Model::Committee;
use NMLegis::UI::Model::CommitteeReport;
use NMLegis::UI::Model::Hearing;
use NMLegis::UI::Model::Bill;
use NMLegis::UI::Model::Tracker;
use NMLegis::UI::Model::User;

sub new ($class) {
    state $dbix = DBIx::Simple->connect(
        "dbi:SQLite:dbname=$DbFile", undef, undef, {
            sqlite_string_mode => DBD_SQLITE_STRING_MODE_UNICODE_STRICT,
            journal_mode => 'WAL',
            synchronous => 'NORMAL',
            foreign_keys   => 1,
        },
    );
    bless { _dbix => $dbix }, $class;
}

#################
#  legislators  #  Plural. Returns list
#################
sub legislators ($self, @args) {
    return NMLegis::UI::Model::Legislator->find($self->{_dbix}, @args);
}

################
#  legislator  #  Singular. Returns one object.
################
sub legislator ($self, @args) {
    # Make sure to call in list context
    my ($l) = NMLegis::UI::Model::Legislator->find($self->{_dbix}, @args);

    return $l;
}

# You get the idea
sub committees ($self, @args) {
    return NMLegis::UI::Model::Committee->find($self->{_dbix}, @args);
}

sub committee ($self, $arg) {
    # Make sure to call in list context
    my ($c) = NMLegis::UI::Model::Committee->find($self->{_dbix}, $arg);

    return $c;
}

sub commitee_reports ($self, @args) {
    return NMLegis::UI::Model::CommitteeReport->find($self->{_dbix}, @args);
}

sub commitee_report ($self, @args) {
    my (@r) = NMLegis::UI::Model::CommitteeReport->find($self->{_dbix}, @args);

    if (@r > 1) {
        warn "UH-OH! Multiple matches for committeereport @args";
    }
    return $r[0];
}

sub hearings ($self, @args) {
    return NMLegis::UI::Model::Hearing->find($self->{_dbix}, @args);
}

sub bills ($self, @args) {
    return NMLegis::UI::Model::Bill->find($self->{_dbix}, @args);
}

sub bill ($self, $arg) {
    my ($b) = NMLegis::UI::Model::Bill->find($self->{_dbix}, $arg);
    return $b;
}

sub trackers ($self, @args) {
    return NMLegis::UI::Model::Tracker->find($self->{_dbix}, @args);
}

sub tracker ($self, $arg) {
    my ($t) = NMLegis::UI::Model::Tracker->find($self->{_dbix}, $arg);
    return $t;
}

sub users ($self, @args) {
    return NMLegis::UI::Model::User->find($self->{_dbix}, @args);
}

sub user ($self, $arg) {
    my ($u) = NMLegis::UI::Model::User->find($self->{_dbix}, $arg);
    return $u;
}

1;
