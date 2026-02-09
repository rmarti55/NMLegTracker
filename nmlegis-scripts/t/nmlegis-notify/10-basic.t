#!/usr/bin/perl
#
# tests for get-bills
#

use v5.36;
use warnings;
use strict;

use utf8;
use open qw( :encoding(UTF-8) :std );

use Data::Dump;
use File::Basename;
use File::Find;
use File::Path          qw(make_path);
use File::Temp          qw(tempfile);
use FindBin;
use Test::More;
use Test::Differences;
use Time::Piece;

###############################################################################
# BEGIN test finding

our @Tests;
my $test_count = 2;

# Directory with our test data
(my $testdir = $0) =~ s/\.t$/.d/
    or die "Internal error: Could not find test dir from test name $0";

my $db_in = "$testdir/db.sql";
-e $db_in
    or die "Internal error: not found: $db_in";

opendir my $dir_fh, $testdir
    or die "Internal error: opendir $testdir: $!";
for my $ent (sort readdir $dir_fh) {
    next if $ent =~ /^\./;              # skip dotfiles
    next if $ent =~ /~$/;               # skip emacs backups
    next if $ent eq 'db.sql';

    -d "$testdir/$ent"
        or die "Internal error: Not a directory: $testdir/$ent";
    push @Tests, +{ name => $ent };

    opendir my $fh2, "$testdir/$ent"
        or die "Internal error: opendir $testdir/$ent: $!";

    # Whether there's one .json or a hundred, they all count as 1 test.
    ++$test_count;

    for my $test_ent (sort readdir $fh2) {
        next if $test_ent =~ /^\./;      # skip dotfiles
        next if $test_ent =~ /~$/;       # skip emacs backups

        if ($test_ent =~ /\.json$/) {
            push @{$Tests[-1]{json}}, "$testdir/$ent/$test_ent";
        }
        elsif ($test_ent =~ /^user(\d+)\.expect\.txt$/) {
            $Tests[-1]{expect}[$1] = "$testdir/$ent/$test_ent";
            ++$test_count;
        }
        elsif ($test_ent =~ /\.expect\.dump$/) {
            die "FATAL: $testdir/$ent : Can only have one .dump file"
                if exists $Tests[-1]{dump};
            $Tests[-1]{dump} = "$testdir/$ent/$test_ent";
            ++$test_count;
        }
        else {
            warn "WARNING: Ignoring unknown file $testdir/$ent/$test_ent\n";
        }
    }
    closedir $fh2;

    exists $Tests[-1]{json}
        or die "Internal error: no json files found in $testdir/$ent";
    exists $Tests[-1]{expect}
        || exists $Tests[-1]{dump}
        or die "Internal error: no expect or dump files found in $testdir/$ent";
}
closedir $dir_fh;

plan tests => $test_count;

# END   test finding
###############################################################################
# BEGIN test setup

# Create a database
# FIXME: refactor!
my (undef, $dbfile) = tempfile("NMLegis-UI-mojo.XXXXXX", TMPDIR => 1, SUFFIX => ".sqlite", UNLINK => !$ENV{DEBUG});
open my $fh_sqlite, '|-', 'sqlite3', $dbfile
    or die "Could not fork pipe to sqlite: $!";
print { $fh_sqlite } "PRAGMA sqlite_unicode = 1;\n";
open my $fh_schema, '<', 'db/schema.sql'
    or die "Could not read schema.sql: $!";
while (my $line = <$fh_schema>) {
    print { $fh_sqlite } $line;
}
close $fh_schema;

# Initialize it with test data
open my $fh_testdata, '<', $db_in
    or die "Internal error: open $db_in: $!";
my $YYYY = localtime->year;
while (my $line = <$fh_testdata>) {
    $line =~ s/YYYY/$YYYY/g;
    print { $fh_sqlite } $line;
}
close $fh_testdata;
close $fh_sqlite
    or die "error running sqlite3: $!";

$ENV{NMLEGIS_UI_TEST_DB} = $dbfile;

# END   test setup
###############################################################################
# BEGIN tests

use_ok "NMLegis";
require_ok "nmlegis-notify";

for my $test (@Tests) {
    my (undef, @history) = NMLegis::Notify::get_history(@{$test->{json}});
    ok 1, "$test->{name}: read history file";

    # compare @history
    if ($test->{dump}) {
        my $actual = Data::Dump::dump(\@history);

        #is scalar(@history), 8, "number of history entries";
        #is $history[0][0], 1769191261, "timestamp of history entries";
        compare_messages($actual, $test->{dump}, "$test->{name} : dump");
    }

    # Compare user notifications
    if ($test->{expect}) {
        for my $uid (1 .. $#{$test->{expect}}) {
            my $path_expect = $test->{expect}[$uid]
                or next;

            my $actual = NMLegis::Notify::_find_notifications($uid, @history) || '';
            compare_messages($actual, $path_expect, "$test->{name}: user $uid");
        }
    }
}

# FIXME: find a way to add comments to json or expect files

# User 2 tracks some of the same bills, and some different ones.
# Note that SB123 appears here in Tracker 4, not Tracker 2

# User 3 only tracks public trackers.



sub compare_messages( $actual, $path_expect, $testname ) {
    chomp $actual if $actual =~ /\n\n$/;

    # FIXME: write to data file, and run cmp. Run diff instead?
    (my $path_actual = $path_expect) =~ s|\.expect\.|.actual.|
        or die "Internal error: not a .expect file: $path_expect";
    open my $fh_out, '>', $path_actual
        or die "Internal error: open >$path_actual: $!";
    print { $fh_out } $actual;
    close $fh_out
        or die "Internal error: writing $path_actual: $!";

    system('diff', '-u', $path_expect, $path_actual);
    ok $? == 0, $testname;
    if ($? == 0) {
        unlink $path_actual;
    }
    else {
        # Caller can git-revert if new output is unwanted
        chmod 0444 => $path_actual;
        rename $path_actual => $path_expect;
    }
}
