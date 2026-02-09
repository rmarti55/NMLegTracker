#!/usr/bin/perl
#
# tests for get-bills
#

use v5.14;
use warnings;
use strict;

use utf8;
use open qw( :encoding(UTF-8) :std );

use File::Basename;
use File::Find;
use File::Path          qw(make_path);
use Test::More;

# Tests live in a subdirectory; replace .t with .d to find test files
(my $test_dir = $0) =~ s/\.t$/.d/
  or die "Could not get test directory from '$0'";

# Get tests
my @expect = glob("$test_dir/*.json");

plan tests => 2 + @expect;
use_ok "NMLegis";
require_ok "nmlegis-get-bills";

for my $json (@expect) {
    # \S handles 's' (special session), 's2' (2nd special session)
    $json =~ m!/(\d+(s\d*)?)\.json$!
        or die "Unexpected test file name '$json', expected 'YYYY.json'";
    my $session = $1;

    # Input file is not checked in; read it from our cache.
    # FIXME: this means we can never add tests for current year, because
    # the input file is too dynamic
    # FIXME: this also means we break if nmlegis changes their table format
    {
        no warnings 'once';
        $ENV{NMLEGIS_USE_CACHE} = 1;
        $NMLegis::Scrape::Cache_Dir = "$ENV{HOME}/.cache/nmlegis/get-bills/$session";
    }

    my $bills = ESM::NMLegisBills::get_bills();
    my $changed = NMLegis::write_json_outfile($bills, $json);
    ok !$changed, "bills($session)";
}
