# -*- perl -*-
#
# NMLegis - Ed's library for processing nmlegis.gov data
#
# $Id$
#
package NMLegis;

use v5.14;
use utf8;
use open qw( :encoding(UTF-8) :std );

use Carp;
use File::Basename              qw(dirname basename);
use File::Path                  qw(make_path);
use File::Slurp;
use JSON::XS;

###############################################################################
# BEGIN user-configurable section

# Program name of our caller
(our $ME = $0) =~ s|.*/||;

use Time::Piece;
our $YYYY = localtime->year;
our $YY   = localtime->yy;

$YYYY =~ /^(\d{4})$/ or die;
$YYYY = $1;

# Base URL
our $NMLEGIS = 'https://www.nmlegis.gov';

# Where we store (and reference) our product files.
# FIXME: should this really be under $HOME? Should we define a config file?
our $Data_Dir = sprintf("%s/nmlegis",
                        $ENV{XDG_DATA_HOME} || "$ENV{HOME}/.local/share");

# Months
our @MoY = qw(Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec);
our %MoY = map { lc($MoY[$_]) => $_ + 1 } (0..$#MoY);

# END   user-configurable section
###############################################################################

# Package version accessible to our caller via "$<this_package>::VERSION"
our $VERSION = '0.1';

# For non-OO exporting of code, symbols
our @ISA         = qw(Exporter);
our @EXPORT      = qw($NMLEGIS);
our @EXPORT_OK   = qw(
                         $NMLEGIS
                         $Data_Dir $YYYY $YY
                         write_json_outfile
                         @MoY %MoY
                 );
our %EXPORT_TAGS =   (all => \@EXPORT_OK);


###############################################################################
# BEGIN write json output file

########################
#  write_json_outfile  #  Write nicely-formatted json file
########################
sub write_json_outfile {
    my $data = shift;                   # in: data object
    my $path = shift;                   # in: full path to output file

    # Make sure parent directory exists
    my $dir = dirname($path);
    make_path($dir, { verbose => 1, mode => 0755 });

    my $out_tmp = "$path.tmp.$$";
    open my $out, '>', $out_tmp
        or die "$ME: Cannot create $out_tmp: $!\n";

    # Counterintuitively, utf8(0) is what generates correct output.
    my $coder = JSON::XS->new->utf8(0)->pretty->canonical;

    my $results = $coder->encode($data);

    # Special-case formatting for bills: put sponsors all on one line
    # Ditto for "bills" in schedule.json and "days" in committees
    $results =~ s{("(sponsors|bills|billh|days_parsed)"\s+:\s+\[.*?\])}{
        my $s = $1;
        $s =~ s/\n\s+//g;
        $s;
    }gexs;

    print { $out } $results;
    close $out
        or die "$ME: Error writing $out_tmp: $!\n";
    chmod 0444, $out_tmp;

    # Return 1 if changed, 0 if same
    my $rc = 0;

    if (-e $path && system('cmp', '-s', "$path", "$out_tmp") != 0) {
        # Files have changed.
        $rc = 1;

        # Does our caller have a compute_changelog function?
        my ($caller_package, undef, undef) = caller();
        if (my $diff_handler = $caller_package->can("compute_changelog")) {
            my $old_data = decode_json(read_file($path));
            my $diffs = $diff_handler->($old_data, $data);
            my $billhistory = $diffs->{by_bill};
            if ($billhistory && @$billhistory) {
                # Write a diffs file
                # Use time of script start
                my $lt = localtime($^T);
                my $output = { _schema   => '20230201', # FIXME
                               _datetime => $lt->datetime,
                               history   => $billhistory, };

                my $diff_dir  = sprintf("%s/history/%s", $Data_Dir, $lt->ymd);
                my $diff_file = sprintf("%s/%s.json",    $diff_dir, $lt->hms);
                mkdir $diff_dir, 02755 if ! -d $diff_dir;
                die "$ME: diff-file already exists: $diff_file\n"
                    if -e $diff_file;
                open my $fh, '>', $diff_file
                    or die "$ME: Cannot create $diff_file: $!\n";

                # Counterintuitively, utf8(0) is what generates correct output.
                my $coder = JSON::XS->new->utf8(0)->pretty->canonical;
                print { $fh } $coder->encode($output);
                close $fh
                    or die "$ME: Error writing $diff_file: $!\n";

                # hg commit it
                if (-d "$dir/.hg") {
                    system('hg', '--cwd' => $dir, 'addremove', 'history');
                    # FIXME: need better commit message
                    system('hg', '--cwd' => $dir, '-q', 'commit', "-m$ME: history files", 'history');
                }

                system("nmlegis-notify", $diff_file);
            }
        }
    }
    elsif (! -e $path) {
        # File is new. Always write it.
        $rc = 1;
    }

    if ($rc) {
        # FIXME
        my $NOT;
        if ($NOT) {
            warn "$ME: leaving $out_tmp\n";
        }
        else {
            rename $out_tmp => $path
                or die "$ME: Cannot rename $out_tmp: $!\n";
        }
    }
    else {
        # No change
        unlink $out_tmp;
    }

    if (-d "$dir/.hg") {
        system('hg', '--cwd' => $dir, 'addremove', basename($path));
        system('hg', '--cwd' => $dir, 'diff');
        # FIXME: need better commit message
        system('hg', '--cwd' => $dir, '-q', 'commit', "-m$ME: checkpoint");
    }

    return $rc;
}

# END   write json output file
###############################################################################

1;


###############################################################################
#
# Documentation
#

=head1	NAME

FIXME - FIXME

=head1	SYNOPSIS

    use Fixme::FIXME;

    ....

=head1	DESCRIPTION

FIXME fixme fixme fixme

=head1	CONSTRUCTOR

FIXME-only if OO

=over 4

=item B<new>( FIXME-args )

FIXME FIXME describe constructor

=back

=head1	METHODS

FIXME document methods

=over 4

=item	B<method1>

...

=item	B<method2>

...

=back


=head1	EXPORTED FUNCTIONS

=head1	EXPORTED CONSTANTS

=head1	EXPORTABLE FUNCTIONS

=head1	FILES

=head1	SEE ALSO

L<Some::OtherModule>

=head1	AUTHOR

Ed Santiago <ed@edsantiago.com>

=cut
