#!/usr/bin/perl
#
# To add more test PDFs:
#
#   $ PERL5LIB=bin:lib t/nmlegis-get-calendars/10-full.t DUMP=/2022/02
#
# This finds all PDFs under $Cache_Dir/2022/02 and dumps their JSONs.
# You can then 'git add' those.
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

my @pdfs;

# Special case: if called with 'DUMP=/PATH', dump all files in $cache_dir/PATH
#    $ perl -Ibin -Ilib t/nmlegis-get-calendars/10-full.t DUMP=/2023
#    $ git add t/nmlegis-get-calendars/10-full.d/2023
if (@ARGV) {
    for my $arg (@ARGV) {
        $arg =~ m!^DUMP=/(.*)!
            or die "Invalid argument '$arg'; expected DUMP=/path";
        my $path = $1;
        -e "$cache_dir/$path"
            or die "No $cache_dir/$path";

        push @pdfs, map { "$path/$_" } find_files("$cache_dir/$path", 'pdf');
    }
}
else {
    @pdfs = map { s/\.json$/.pdf/; $_ } find_files($test_dir, 'json');
}

plan tests => 2 + @pdfs;
use_ok "NMLegis";
require_ok "nmlegis-get-calendars";

for my $pdf (@pdfs) {
    my $subdir = dirname($pdf);
    my $basename = basename($pdf, '.pdf');

    my %sched;
    my ($text, $mtime) = NMLegis::Scrape::read_cache_file("$cache_dir/$pdf");

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

    if ($@) {
        ok 0, "$pdf - failed to parse: $@";
        next;
    }

    make_path("$test_dir/$subdir", { verbose => 1, mode => 0755 });
    my $changed = NMLegis::write_json_outfile(\%sched, "$test_dir/$subdir/$basename.json");
    ok !$changed, "$pdf"
}

sub find_files {
    my $path = shift;                   # in: path to search
    my $ext  = shift;                   # in: .pdf or .json

    my @files;
    my $finder = sub {
        return if $File::Find::name =~ m!/\.[^/]+$!;   # skip dotfiles
        return unless $File::Find::name =~ /\.$ext$/;
        (my $base = $File::Find::name) =~ s!^$path/!!;

        # Usage: WANT=2024 perl -Ibin -Ilib t/nmlegis-get-calendars/10-full.t
        if (my $want = $ENV{WANT}) {
            return unless $base =~ m!^$want!;
        }

        push @files, $base;
    };

    find { wanted => $finder, no_chdir => 1 }, $path;

    return sort @files;
}
