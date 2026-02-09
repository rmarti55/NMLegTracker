#!/usr/bin/perl
#
# tests for NMLegis::Bills::_parse_actions
#

use v5.14;
use warnings;
use strict;

use utf8;
use open qw( :encoding(UTF-8) :std );

use Test::More;
use Test::Differences;

# No need to wrap these in 'use_ok'
use NMLegis;
use NMLegis::Bills;

use Data::Dump;
use File::Slurp         qw(read_file);
use FindBin;
use JSON::XS;

# Input data files are bills.json files from prior years. (We can't
# use this year's because it's constantly in flux).
(my $rootdir = $FindBin::Bin) =~ s!/t/lib/NM.*$!/t!
    or die "Internal error: Not a /t/lib/NM dir: $FindBin::Bin";

my $source_dir = "$rootdir/nmlegis-get-bills/10-full.d";
-d $source_dir
    or die "Internal error: input directory does not exist: $source_dir";

my @jsons = glob("$source_dir/*.json")
    or die "Internal error: no *.json files in $source_dir";

my %all_bills;
for my $json_file (@jsons) {
    $json_file =~ m!/(\d+\w*)\.json$!
        or die "Internal error: invalid json file '$json_file'";
    my $session = $1;
    my $json = read_file($json_file);
    $all_bills{$session} = decode_json($json);
}

plan tests => scalar(@jsons);

# We compare against prior results.
(my $test_dir = $0) =~ s/\.t$/.d/
  or die "Could not get test directory from '$0'";

# Run tests. Gather together all bills for one session, and parse
# their "actions" lines.
for my $session (sort keys %all_bills) {
    my @results;

    for my $chamber (sort keys %{$all_bills{$session}}) {
        for my $type (sort keys %{$all_bills{$session}{$chamber}}) {
            for my $billno (sort { $a <=> $b } keys %{$all_bills{$session}{$chamber}{$type}}) {
                my $billname = "$chamber$type$billno";
                my $actions = $all_bills{$session}{$chamber}{$type}{$billno}{actions}
                    || die "Internal error: $session - $billname: no actions";

                my @warnings;
                local $SIG{__WARN__} = sub {
                    my $warning = shift;
                    $warning =~ s|^\S+:\s+||;
                    $warning =~ s|\s+at\s+\S+\s+line.*$||s;
                    $warning =~ s|\s+\(from\s.*\), cannot continue$||;
                    push @warnings, $warning;
                };
                my $actual = NMLegis::Bills::_parse_actions($actions);
                $actual->{warnings} = \@warnings        if @warnings;
                $actual->{_billname} = $billname;
                push @results, $actual;
            }
        }
    }

    # Write as output file
    my $outfile = "$test_dir/$session";
    my $out_tmp = "$outfile.tmp.$$";
    open my $out_fh, '>', $out_tmp
        or die "Cannot create $out_tmp: $!";
    print { $out_fh } Data::Dump::dump(\@results);
    close $out_fh
        or die "Error writing $out_tmp: $!";

    if (-e $outfile) {
        system("cmp", "-s", $outfile, $out_tmp);
        if ($?) {
            ok 0, "$session -- use git-diff to see differences";
            rename $out_tmp => $outfile;
        }
        else {
            ok 1, "$session session";
            unlink $out_tmp;
        }
    }
    else {
        # First time running for this year
        ok 0, "$session - no existing data file";
        rename $out_tmp => $outfile;
    }
}
