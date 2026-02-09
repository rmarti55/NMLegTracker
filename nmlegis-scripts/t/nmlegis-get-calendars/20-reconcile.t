#!/usr/bin/perl
#
# To add more test dates:
#
#  $ touch t/nmlegis-get-calendars/20-reconcile.d/2023/02/2023-02-99.json
#

use v5.14;
use utf8;
use open qw( :encoding(UTF-8) :std );

use File::Basename;
use File::Find;
use File::Path          qw(make_path);
use Test::More;

# Tests live in a subdirectory; replace .t with .d to find test files
(my $test_dir = $0) =~ s/\.t$/.d/
  or die "Could not get test directory from '$0'";

# FIXME: duplication of code in NMLegis.pm; but without the YYY
my $cache_dir = "$ENV{HOME}/.cache/nmlegis/get-calendars";

my @test_files = find_test_files($test_dir);

plan tests => 2 + @test_files;
use_ok "NMLegis";
require_ok "nmlegis-get-calendars";

TEST_FILE:
for my $test_file (@test_files) {
    $test_file =~ m!/(\d{4})-(\d{2})-(\d{2})\.json$!
        or die "Invalid test file name '$test_file'";
    my ($yyyy, $mm, $dd) = ($1, $2, $3);
    my $ymd = "$1-$2-$3";

    my %sched;
    # Find all PDFs for that date
    for my $pdf (find_pdfs($cache_dir, $yyyy, $mm, $dd)) {
        my $basename = basename($pdf, '.pdf');
        my ($text, $mtime) = NMLegis::Scrape::read_cache_file($pdf);

        # FIXME: ignore warnings
        local $SIG{__WARN__} = sub {};

        if ($basename =~ m!^((H|S)[A-Z]+C)age!) {
            eval { ESM::NMLegisCalendars::parse_single_committee(\%sched, $pdf, $text, $mtime, $1) };
        }
        elsif ($basename =~ m!^(h|s)Sched!) {
            eval { ESM::NMLegisCalendars::parse_long_schedule(\%sched, $pdf, $text, $mtime, uc($1)) };
        }
        elsif ($basename =~ m!^(h|s)Floor!) {
            eval { ESM::NMLegisCalendars::parse_floor(\%sched, $pdf, $text, $mtime, uc($1)) };
        }
        else {
            die "Cannot parse calendar '$basename'";
        }

        if ($@) {
            ok 0, "$ymd: failed to parse $pdf: $@";
            next TEST_FILE;
        }
    }

    # Write out the reconciled json. If it changed, we fail
    my $changed = NMLegis::write_json_outfile(\%sched, "$test_dir/$test_file");
    ok !$changed, $test_file;
}

sub find_test_files {
    my $path = shift;                   # in: path to search

    my @files;
    my $finder = sub {
        return if $File::Find::name =~ m!/\.[^/]+$!;   # skip dotfiles
        return unless $File::Find::name =~ /\.json$/;
        (my $base = $File::Find::name) =~ s!^$path/!!;

        push @files, $base;
    };

    find { wanted => $finder, no_chdir => 1 }, $path;

    return sort @files;
}


sub find_pdfs {
    my ($cache_dir, $yyyy, $mm, $dd) = @_;

    my @files;
    my $finder = sub {
        return if $File::Find::name =~ m!/\.[^/]+$!;   # skip dotfiles
        return unless $File::Find::name =~ /\.pdf$/;

        # Required year and month
        next unless $File::Find::name =~ m!/$yyyy/$mm/!;

        # Committee schedules
        if ($File::Find::name =~ m!/((S|H)[A-Z]+)/\1age\w+$dd\.!) {
            push @files, $File::Find::name;
        }

        # Many-page PDFs
        elsif ($File::Find::name =~ m!/((h|s)Sched)/\w+$mm$dd!) {
            push @files, $File::Find::name;
        }
        elsif ($File::Find::name =~ /Sched/) {
            ;
        }

        # Floor. Only reconciled when there's a Supplemental calendar
        elsif ($File::Find::name =~ m!/((h|s)Floor)/\g{1}${mm}${dd}!) {
            push @files, $File::Find::name;
        }
    };

    find { wanted => $finder, no_chdir => 1 }, "$cache_dir/$yyyy";

    return sort @files;
}
