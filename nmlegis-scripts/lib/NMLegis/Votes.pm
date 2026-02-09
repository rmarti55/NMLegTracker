# -*- perl -*-
#
# NMLegis::Votes - operations on committee and floor votes
#
package NMLegis::Votes;

use strict;
use warnings;

use Carp;

use NMLegis                     qw(:all);

###############################################################################
# BEGIN user-configurable section

our $Committee_Vote_File = "$Data_Dir/committee-votes-$YYYY.tsv";
our @Committee_Votes;

# FIXME
our @Floor_Votes;

# END   user-configurable section
###############################################################################

# Program name of our caller
(our $ME = $0) =~ s|.*/||;

# RCS id, accessible to our caller via "$<this_package>::VERSION"
(our $VERSION = '$Revision: 0.0 $ ') =~ tr/[0-9].//cd;

# For non-OO exporting of code, symbols
our @ISA         = qw(Exporter);
our @EXPORT      = qw();
our @EXPORT_OK   = qw(all committee_votes floor_votes);
our %EXPORT_TAGS =   (all => \@EXPORT_OK);

###########
#  _init  #  load data file
###########
sub _init {
    return if @Committee_Votes;

    open my $fh_in, '<', $Committee_Vote_File
        or croak "open $Committee_Vote_File: $!";

    while (my $line = <$fh_in>) {
        chomp $line;
        push @Committee_Votes, [ split "\t", $line ];
    }
    close $fh_in;

    # FIXME: someday: read floor votes
}

#########
#  all  #  Return list of all votes
#########
sub all {
    _init();

    @Floor_Votes, @Committee_Votes;
}


sub committee_votes {
    _init();

    @Committee_Votes;
}

sub floor_votes {
    _init();

    @Floor_Votes;
}

1;
