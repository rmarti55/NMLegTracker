# -*- perl -*-
#
# NMLegis::Scrape - tools for web scraping
#
package NMLegis::Scrape;

use v5.14;
use utf8;
use open qw( :encoding(UTF-8) :std );

use strict;
use warnings;

use Carp;
use File::stat;
use File::Path                  qw(make_path);
use File::Slurp                 qw(read_file write_file);
use JSON::XS;
use LWP::UserAgent;
use Time::Piece;

# Custom mirror function using LWP::UserAgent with SSL options
sub mirror {
    my ($url, $file) = @_;
    my $ua = LWP::UserAgent->new;
    $ua->ssl_opts(verify_hostname => 0, SSL_verify_mode => 0x00);
    $ua->agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) NMLegis-Scraper/1.0");
    my $response = $ua->get($url);
    if ($response->is_success) {
        write_file($file, { binmode => ':raw' }, $response->content);
        return $response->code;
    }
    return $response->code;
}

use NMLegis                     qw(:all);

# Program name of our caller
(our $ME = $0) =~ s|.*/||;

###############################################################################
# BEGIN user-configurable section

# Cache directory *for this individual script*, e.g. get-calendars, watch
# This is where we save fetched html
(our $Cache_Dir = sprintf("%s/.cache/%s/%s", $ENV{HOME}, $ME, $YYYY))
    =~ s|/nmlegis-|/nmlegis/|;

# END   user-configurable section
###############################################################################
# BEGIN hg-commit code
#
# If there are cache files to commit, do so at the end

our @Cache_Files_to_Commit;
END {
    if (@Cache_Files_to_Commit) {
        # FIXME: need a better message
        my $msg = "checkpoint from $ME";
        system('hg', '--cwd' => $Cache_Dir, '-q', 'commit', "-m$msg");
    }
}

# END   hg-commit code
###############################################################################

# RCS id, accessible to our caller via "$<this_package>::VERSION"
(our $VERSION = '$Revision: 0.0 $ ') =~ tr/[0-9].//cd;

# For non-OO exporting of code, symbols
our @ISA         = qw(Exporter);
our @EXPORT      = qw();
our @EXPORT_OK   = qw();
our %EXPORT_TAGS =   (all => \@EXPORT_OK);

###########
#  fetch  #  main interface here
###########
sub fetch {
    my $proto = shift;
    my $class = ref($proto) || $proto;
    my $url   = shift;

    $url =~ m!^https?://.*nmlegis\.gov/!
        or croak "$ME: bad url '$url'";

    my $self = get_and_cache($url);
    return bless $self, $class;
}

###############################################################################
# BEGIN http helpers

#################
#  _cache_file  #  Given a URL, returns path to local cache file
#################
sub _cache_file {
    my $url = shift;

    # Create Cache_Dir if missing (i.e., at the beginning of a new term)
    if (! -d $Cache_Dir) {
        mkdir $Cache_Dir, 02755
            or die "$ME: Could not mkdir $Cache_Dir: $!\n";
    }

    # hg-init it
    if (! -d "$Cache_Dir/.hg") {
        system('hg', '--cwd' => $Cache_Dir, 'init') == 0
            or die "$ME: Error running 'hg init' in $Cache_Dir\n";
    }

    (my $cache_file = $url) =~ s!^$NMLEGIS/!!;

    # For committee pages
    $cache_file =~ s!^Committee/!!;
    $cache_file =~ s/\?CommitteeCode=/--/;

    # For legislator pages
    $cache_file =~ s/\?T=/--/;
    $cache_file =~ s/\?SponCode=/--/;

    # For bill pages
    $cache_file =~ s/[\?\&](Chamber|LegType|LegNo|year)/-/g;

    # For all other pages: remove params
    $cache_file =~ s/\?.*$//;

    # For all pages: remove slashes, colons, other stuff
    $cache_file =~ s{[^a-z0-9_.-]}{_}gi;

    # For calendar pages: write into tree structure
    # (make sure to do this after filtering out slashes!)
    if ($cache_file =~ s!^Agendas_[^_]+_!!) {
        my $subdir;
        if ($cache_file =~ m!^(h|s)(Floor|Sched)(\d\d)!) {
            $subdir = "$3/$1$2";
        }
        elsif ($cache_file =~ m!^((H|S)([A-Z]+))age(\w\w\w)!) {
            my %MoY = (Jan => "01", Feb => "02", Mar => "03");
            my $mm = $MoY{$4}
                or die "$ME: cache file $cache_file: unknown month '$4'";
            $subdir = "$mm/$1";
        }
        elsif ($cache_file =~ m!^Calendar_Session!) {
            # ok
        }
        else {
            warn "$ME: Unknown agenda filename '$cache_file' in '$url'";
            $subdir = "misc";
        }

        make_path("$Cache_Dir/$subdir", { verbose => 1, mode => 0755 });
        $cache_file = "$subdir/$cache_file";
    }

    # For bill data: strip off leading unnecessary stuff
    # Regular_bills_house -> house_bills; bills_house_HBXX -> HBXX
    if ($cache_file =~ s!^Sessions_\d+_\d+Regular_(\w+)_(\w+)_+!${2}_${1}!) {
        $cache_file =~ s!^[a-z_]+([HS])!$1!;
        $cache_file =~ s!^Reports_Tabled([HS])!$1!;
    }
    $cache_file =~ s!^Sessions_\d+_\d+Regular_Tabled_Reports!tabled!;
    if ($cache_file =~ s!^Sessions_\d+_\d+Regular_(firs|votes|LESCAnalysis|LFCForms|Committee_Subs_And_Amendments)!$1!) {
        if ($cache_file =~ s!(firs|votes|LESCAnalysis|LFCForms|Committee_Subs_And_Amendments)_+([HS])!$1/$2!) {
            make_path("$Cache_Dir/$1", { verbose => 1, mode => 0755 });
        }
    }

    # Add extension, if there isn't already one
    $cache_file .= '.html'  unless $cache_file =~ m!\.[^/]+$!;

    $cache_file;
}

###################
#  get_and_cache  #  Get a URL and cache it. Returns HREF of content, url, etc
###################
sub get_and_cache {
    my $url = shift;

    my $cache_file = _cache_file($url);

    my %data = (
        url        => $url,
        cache_file => "$Cache_Dir/$cache_file",
    );

    # On request, if cache file exists, read & return it
    if ($ENV{NMLEGIS_USE_CACHE}) {
        if (-e "$Cache_Dir/$cache_file") {
            print "[ $cache_file ]\n";
            my ($html, $mtime) = read_cache_file("$Cache_Dir/$cache_file");
            $data{html} = $html;
            $data{mtime} = $mtime;
            return \%data;
        }
    }

    my $code = mirror($url, "$Cache_Dir/$cache_file");
    die "$ME: $url : $code" if $code >= 400;
    -e "$Cache_Dir/$cache_file"
        or die "$ME: mirror() did not actually mirror $url - code=$code";

    if (-d "$Cache_Dir/.hg") {
        system('hg', '--cwd' => $Cache_Dir, 'addremove', $cache_file);
        # Bunch up all the files to commit, and do them all at the end.
        push @Cache_Files_to_Commit, $cache_file;
    }

    my ($html, $mtime) = read_cache_file("$Cache_Dir/$cache_file");
    $data{html} = $html;
    $data{mtime} = $mtime;

    return \%data;
}

#####################
#  read_cache_file  #  Read and return a cached URL, converting to txt if PDF
#####################
sub read_cache_file {
    my $path = shift;

    croak "$ME: No such path: $path" if ! -e $path;

    my $mtime = localtime(stat($path)->mtime)->datetime;

    if ($path =~ /\.pdf$/) {
        open my $fh, '-|', 'pdftotext', '-q', '-nopgbrk', '-layout', $path, '-'
            or die "$ME: Cannot fork: $!\n";
        my $content = do { local $/ = undef; <$fh>; };
        close $fh
            or die "$ME: Error running pdftotext on $path\n";
        return ($content, $mtime);
    }

    return (scalar(read_file($path,  {binmode => ':utf8'})), $mtime);
}

# END   http helpers
###############################################################################





1;
