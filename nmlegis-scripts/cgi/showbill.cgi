#!/usr/bin/perl -T
#
# showbill.cgi - show a bill
#
package NMLegis::ShowBill;

use strict;
use warnings;

use CGI qw(:standard);

use lib '/home/esm/src/nmlegis/lib';

BEGIN { $ENV{HOME} = '/home/esm' }

use NMLegis                     qw(:all);
use NMLegis::Bills;

use Date::Parse;
use File::Slurp;
use HTML::Entities;
use Time::Piece;

###############################################################################
# BEGIN user-configurable section

our $Headers = <<'END_HEADERS';
<?xml version="1.0" encoding="utf-8" ?>
<!DOCTYPE html
        PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
         "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en-US">

<head>
 <title>%s</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="../nmlegis.css" />
<link rel="stylesheet" href="../collapsible.css" />
<link rel="stylesheet" href="../popup.css" />
</head>
END_HEADERS

# END   user-configurable section
###############################################################################

###############################################################################
# Code begins here

# Force autoflush on stdout
$| = 1;

my $bill_param = param('bill')
    or do {
        print header(-status => 400),
            sprintf($Headers, "400 Bad Request"),
            "<h1>Missing 'bill' param</h1>",
            end_html();
        exit 0;
    };

if (my $yyyy = param('year')) {
    if ($yyyy =~ /^(\d{4})$/) {
        $YYYY = $1;
    }
}

my $bill = eval { NMLegis::Bills->new(uc($bill_param)) }
    or do {
        print header(-status => 400),
            sprintf($Headers, "400 Bad Request"),
            "<h1>Invalid bill</h1>",
            end_html();
        exit 0;
    };


#
# Begin here: emit HTTP status (200 = OK), and beginnings of HTML
#
my $page_title = sprintf("%s %s %d", map { $bill->get($_) } qw(chamber_name type_name number));

print  header(-expires => '+1h'),
       sprintf($Headers, $page_title),
       "<div id=\"nav\"><a href=\"index.html\">All Bills</a>&nbsp;&rarr;&nbsp;<b>$page_title</b></div>\n",
       h2($page_title . " - " . encode_entities($bill->readable_title)), "\n";

# Financial analyses
my @analyses;
if (my $fir = $bill->fir) {
    push @analyses, [ $fir, "FIR" ];
}
if (my $lesc = $bill->lescanalysis) {
    push @analyses, [ $lesc, "LESC" ];
}
if (my $lfc = $bill->lfcform) {
    push @analyses, [ $lfc, "LFC" ];
}

if (@analyses) {
    printf "<h3>Financial Analys%ss: %s</h3>\n",
        (@analyses == 1 ? 'i' : 'e'),
        join(" | ", (map { sprintf("<a href=\"%s\" target=\"_blank\">%s</a>", @$_) } @analyses));
}

# Point to nmlegis
printf "<h4>[see <a href=\"%s\" target=\"_blank\">bill page on nmlegis.gov</a>]</h4>\n", $bill->url;

my @sponsors = $bill->sponsors;

printf "<br/>\n<table>\n<tr><th colspan=\"3\">Sponsor%s</th></tr>\n",
    (@sponsors == 1 ? '' : 's');
for my $s (@sponsors) {
    printf "<tr class=\"legislatorname party-%s\"><td><a href=\"%s\">%3.3s. %s</a></td><td>%d</td><td>%s</td></tr>\n",
        $s->party,
        $s->local_url,
        $s->title, encode_entities($s->name),
        $s->district,
        encode_entities($s->county);
}
print "</table>\n";

if (my @foo = $bill->html_progress_table) {
    my $classes = join(' ', $bill->css_classes);

    print "<br/>\n<table>\n<tr><th colspan=\"4\">Status</th></tr>\n";
    print "<tr class=\"$classes\">", $_, "</tr>\n"  for @foo;
    print "</table>\n";
}

# Full history
if (my $history = $bill->history) {
    printf <<"END_HTML", encode_entities($history->{actions});
<br/>
<hr/>
<h3>"Official" History</h3>
<p>
  This is the <i>official</i> nmlegis action history. I'm doing my best
  to translate the LONG/WEIRD-STRING to something less gibberishy. And
  before you ask, no, the "Legis&nbsp;Day" number seems to have no
  mapping to the real world.
</p>
<p>
 Actions: <span style=\"font-family: monospace; font-weight: bold;\">%s</span>
</p>
<table>
  <tr><th>Legis Day</th><th>Action</th><th>Details</th></tr>
END_HTML

    # Organize votes by committee
    my @votes = $bill->votes;
    my %votes_by_committee;
    for my $tuple (@votes) {
        my ($committee, $date, $legislator, $vote) = @$tuple;
        push @{ $votes_by_committee{$committee}{$vote} }, $legislator;
    }

    for my $action (@{$history->{history}}) {
        print "<tr>";
        printf "<td>%s</td>", encode_entities($_)   for @$action;

        # Show only 'no' votes, since they're a minority
        if ($action->[1] eq 'passed') {
            my $committee = $action->[2];
            if ($committee =~ /^[A-Z]+$/) {
                if (my $no = $votes_by_committee{$committee}{no}) {
                    printf "<td>Voting no: %s</td>",
                        join(", ", map { NMLegis::Legislators->new($_)->lastname } @$no);
                }
            }
        }
        print "</tr>\n";
    }
    print  "</table>\n";
}

# Local actions
if (my $updates = NMLegis::Bills::updates(60)) {
    my $want = $bill->billno;
    my %found;

    for my $ymd (sort keys %$updates) {
        for my $hms (sort keys %{$updates->{$ymd}}) {
            for my $log (@{$updates->{$ymd}{$hms}{history}}) {
                my ($bill, $action) = @$log;
                if ($bill eq $want) {
                    $found{$ymd} //= [];
                    push @{$found{$ymd}}, $action;
                }
            }
        }
    }

    if (keys(%found)) {
        print <<'END_HTML';
<br/>
<hr/>
<h3>Action History</h3>
<p>
This table shows bill actions detected <i>on Ed's system</i>, using
heuristics that may not be 100% accurate and which may not reflect
the "official" nmlegis chronology.
</p>
<table>
END_HTML

        for my $ymd (sort keys %found) {
            my @actions = @{$found{$ymd}};

            # Friendly date
            $ymd = localtime(str2time($ymd))->strftime("%b %e");
            for my $a (@actions) {
                # Friendly date and time
                $a =~ s{(\d+-\d+-\d+\s+\d+:\d+:\d+)}{
                    localtime(str2time($1))->strftime("%A, %b %e, %H:%M")
                }gex;

                printf "<tr><td>%s</td><td>%s</td></tr>\n",
                    $ymd, encode_entities($a);
                $ymd = '&nbsp;&nbsp;&quot;&nbsp;&quot;';
            }
        }
        print "</table>\n";
    }
}

###############################################################################
# Find bill text
if (-d (my $billmirror = "/home/esm/.cache/nmlegis/mirror-bills/$YYYY")) {
    my @allfiles = read_dir($billmirror);
    my $re = sprintf("%s%s0*%d\\.HTML",
                     map { $bill->get($_) } qw(chamber type number));

    if (my @match = grep { /^$re$/ } @allfiles) {
        my $fname = $match[0];

        # Look for committee substitutions
        $re =~ s/\.HTML/\[A-Z0-9\]\+S\.HTML/;
        if (my @cs = grep { /^$re$/ } @allfiles) {
            # FIXME: there can be more than one :(
            warn "WARNING: More than one CS: @cs\n" if @cs > 1;
            printf <<"END_HTML", $bill->url;
<hr/>
<div style="text-align: center; background: #f99;">
<h2>Committee Substitution!</h2>
<p>
Showing the CS bill below. For the original, please <a href="%s">refer to nmlegis</a>.
</p>
</div>
END_HTML
            $fname = $cs[0];
        }

        if (open my $fh, '<', "$billmirror/$fname") {
            print "<hr/>\n<div class=\"billtext\">\n";
            my $in_body;
            my $new_material_indent = 0;
            while (my $line = <$fh>) {
                chomp $line;
                $line =~ s/\015//g;
                $in_body |= ($line =~ /<body/i);
                next unless $in_body;

                $line =~ s|\sstyle=\"line-h.*?\"||g;

                # Deleted
                $line =~ s{(\sstyle=\".*?text-decoration:\s+line-through)}{${1}; color: #900; background: #ccc}g;
                # New material
                $line =~ s{(\sstyle=\".*?text-decoration:\s+underline)}{${1}; color: #03F; font-weight: bold}g;

                $line = nmsa_replace($line);

                my $indent = 0;
                if ($line =~ m!<span>(&#160.*?)</span>!) {
                    $indent = length(decode_entities($1));
                    if ($new_material_indent && $indent <= $new_material_indent) {
                        $new_material_indent = 0;
                        print "</div>\n";
                    }
                }
                if ($line =~ /\[.*?NEW MATERIAL.*?\]/) {
                    print "<div class=\"new-material\">\n";
                    $new_material_indent = $indent;
                }

                print $line, "\n";
            }
            close $fh;
            print "</div>\n";
        }
    }
}

# Done.
print end_html();
exit 0;


sub nmsa_replace {
    my $line = shift;

    $line =~ s{(\s)(\d+-\d+-\d+\.\d+)\s+NMSA}{
        $1 . nmsa_link($2) . " NMSA";
    }gex;

    $line =~ s{(Chapter\s+)(\d+)(\s+NMSA)}{
           $1 . nmsa_link($2) . $3
    }gex;

    $line =~ s{(Sections?\s+)(.*?)(\s+NMSA)}{
        my ($label, $sections, $nmsa) = ($1, $2, $3);
        my @sections = split(' ', $sections);
        my @retval;
        for my $s (@sections) {
            if ($s =~ /^([\d\.-]+)$/) {
                $s = nmsa_link($s);
            }
            push @retval, $s;
        }
        $label . join(' ', @retval) . $nmsa;
    }gex;

    return $line;
}

sub nmsa_link {
    my $nmsa = shift;

    if ($nmsa =~ /^(\d+)-(\d+)-(\d+)\.(\d+)$/) {
        return "<a href=\"https://law.justia.com/codes/new-mexico/2021/chapter-$1/article-$2/section-$1-$2-$3-$4\" target=\"_blank\">$1-$2-$3.$4</a>";
    }

    if ($nmsa =~ /^(\d+)-(\d+)-(\d+)$/) {
        return "<a href=\"https://law.justia.com/codes/new-mexico/2021/chapter-$1/article-$2/section-$1-$2-$3\" target=\"_blank\">$1-$2-$3</a>";
    }

    # Chapter only
    if ($nmsa =~ /^(\d+)$/) {
        return "<a href=\"https://law.justia.com/codes/new-mexico/2021/chapter-$1\" target=\"_blank\">$1</a>";
    }

    return $nmsa;
}
