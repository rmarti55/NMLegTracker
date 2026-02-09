package NMLegis::UI::Controller::Bills;
use Mojo::Base 'Mojolicious::Controller', -signatures;

use Date::Parse;
use File::Slurp;
use HTML::Entities;
use Time::Piece;

sub index ($self) {
    my @all = $self->db->bills;

    $self->render(bills => \@all);
}

sub bill ($self) {
    my $bill_param = $self->param('bill');

    # FIXME: validate?
    $bill_param =~ s/\.html$//i;

    my $b = $self->db->bill($bill_param)
        or do {
            $self->flash(error => "Invalid/unknown bill");
            warn "Invalid bill param '$bill_param'";
            return $self->redirect_to('/bills');
        };

    $self->render(b => $b, bill_html => bill_text($b));
}

sub filinghistory ($self) {
    my $n_days = 10;            # FIXME: parameterize

    my %by_ymd;
    for my $b ($self->db->bills(filed => $n_days)) {
        $b->{lt} = localtime($b->timestamp);
        my $ymd = $b->{lt}->ymd;
        push @{ $by_ymd{$ymd} }, $b;
    }

    $self->render(n_days => $n_days, by_ymd => \%by_ymd);
}

sub pending ($self) {
    my @pending = $self->db->bills('pending');

    $self->render(bills => \@pending);
}

sub halfpassed ($self) {
    my %passed = (map { $_ => [ $self->db->bills("halfpassed" => $_) ] } qw(House Senate));

    $self->render(bills => \%passed);
}

sub signed ($self) {
    my %by_md;
    my %fulldate;

    for my $b ($self->db->bills('signed')) {
        my $actions = $b->actions;

        my $md;
        if ($actions =~ /SGND.*\((\w+[\.\s]+\d+)\)/) {
            my $t = str2time($1)
                or die "Could not parse time '$1' in '$a'";
            $md = localtime($t)->strftime("%m-%d");
            $fulldate{$md} //= localtime($t)->strftime("%B %e");
        }
        elsif ($actions =~ /SGND\.?\s*$/) {
            $md = '00-01';
            $fulldate{$md} //= '[Signed, Date Unknown]';
            if (my @signed_update = grep { $_->[1] eq 'signed' } $b->updates) {
                my $lt = localtime($signed_update[0][0]);
                $md = $lt->strftime("%m-%d");
                $fulldate{$md} //= $lt->strftime("%B %e");
            }
        }

        push @{$by_md{$md}}, $b       if $md;
    }

    $self->render(by_md => \%by_md, fulldate => \%fulldate);
}

sub vetoed ($self) {
    my %by_md;
    my %fulldate;

    my @bills = $self->db->bills('vetoed');

    # 2025-04-14 EXPERIMENTAL! For Akkana: return a JSON array of bill codes
    $self->respond_to(
        html => sub { $self->render(bills => \@bills) },
        json => { json => [ map { $_->code } @bills ] },
    );
}


###############################################################################
# BEGIN update handling

#################
#  user_report  #  Called via PUT, allows user to report bill status
#################
sub user_report ($self) {
    if (! $self->user) {
        return $self->render(json => { error => 'Not logged in' }, status => 401);
    }

    if (! $self->user->can_update_bills) {
        return $self->render(json => { error => 'You do not have that kind of access' }, status => 401);
    }

    my $select_id = $self->param('id')
        or return $self->render(json => { error => 'request with no id' }, status => 400);

    $select_id =~ /^user-report-(\d+)$/
        or return $self->render(json => { error => 'invalid button ID' }, status => 400);
    my $billid = $1;
    my $b = $self->db->bill($billid)
        or return $self->render(json => { error => 'nonexistent bill ID' }, status => 404);

    my $newvalue;
    for ($self->param('report') || '') {
        if (/^(passed|failed|tabled|withdrawn)$/i)  { $newvalue = lc $1; }
        elsif (/^Remove/i)                          { $newvalue = '-';   }
        else { return $self->render(json => { error => 'invalid report' }, status => 400); }
    }

#    use Data::Dump; dd "GOT HERE", $billid, $newvalue;

    $b->user_report($self->user->id, $newvalue);

    $self->render(json => { ok => "Updated" });
}

# END   update handling
###############################################################################
# BEGIN bill text handling

sub bill_text ($bill) {
    my $html_text = '';

    my $YYYY = $bill->get('session');
    my $billmirror = "/home/esm/.cache/nmlegis/mirror-bills/$YYYY";
    if (! -d $billmirror) {
        # FIXME: find a way to email-notify Ed
        warn "WARNING: Bill mirror dir missing: $billmirror";
        return "[No bill text data available for $YYYY session]";
    }

    my @allfiles = read_dir($billmirror);
    my $re = sprintf("%s%s0*%d\\.HTML",
                     map { $bill->get($_) } qw(chamber type number));

    my @match = grep { /^$re$/ } @allfiles
        or return '[No bill text available]';
    my $fname = $match[0];

    # Look for committee substitutions
    if (my @reports = $bill->committee_reports) {
        if (my @cs = grep { $_->cs } @reports) {
            $html_text .= sprintf(<<"END_HTML", $cs[-1]->committee->name, $bill->nmlegis_url);
<hr/>
<div style="text-align: center; background: #f99;">
<h2>Committee Substitution!</h2>
<p>
Showing the <b>%s</b> substitution below.
For the original as introduced, please <a href="%s">refer to nmlegis</a>.
</p>
</div>
END_HTML

            # "cs" is a URL. We want just the basename.
            ($fname = $cs[-1]->cs) =~ s|^.*/||;
        }
    }

    if (open my $fh, '<', "$billmirror/$fname") {
        $html_text .= "<hr/>\n<div class=\"billtext\">\n";
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
            $line =~ s{(\sstyle=\".*?text-decoration:\s+underline)}{${1}; color: #093; font-weight: bold}g;

            $line = nmsa_replace($line);

            # FIXME: Chaptered legislation. No way to link to the chapter
            # itself, nor to track the chapter back to a bill, but at least
            # link to the SoS page for that year
            $line =~ s{\b(Laws?\s+(\d{4}))}{<a href="https://www.sos.nm.gov/legislation-and-lobbying/signed-chaptered-bills/$2-legislation/" target="_blank">$1</a>}g;

            my $indent = 0;
            if ($line =~ m!<span>(&#160.*?)</span>!) {
                $indent = length(decode_entities($1));
                if ($new_material_indent && $indent <= $new_material_indent) {
                    $new_material_indent = 0;
                    $html_text .= "</div>\n";
                }
            }
            if ($line =~ /\[.*?NEW MATERIAL.*?\]/) {
                $html_text .= "<div class=\"new-material\">\n";
                $new_material_indent = $indent;
            }

            $html_text .= "$line\n";
        }
        close $fh;
        $html_text .= "</div>\n";
    }

    $html_text;
}

sub nmsa_replace {
    my $line = shift;

    #          1                12   23       3
    $line =~ s{((?i)Sections?\s+)(.*?)(\s+NMSA)}{
        my ($label, $sections, $nmsa) = ($1, $2, $3);
        my @sections = split(' ', $sections);
        my @retval;
        if (@sections > 1) {
            for my $s (@sections) {
                if ($s =~ /^([\dA-Z\.-]+)$/) {
                    $s = nmsa_link($s);
                }
                push @retval, $s;
            }
            $label . join(' ', @retval) . $nmsa;
        }
        else {
            nmsa_link(@sections, "$label $sections $nmsa")
        }
    }gex;

    $line =~ s{(\s)(\d+-\d+-\d+\.\d+)\s+NMSA}{
        $1 . nmsa_link($2) . " NMSA";
    }gex;

    # Chapter X, Article Y NMSA
    #          12          23      3               4   5       6      6 1
    $line =~ s{((Chapter\s+)(\d+\w*),?\s+Article\s+(\d+)\s+NMSA(\s+\d+)?)}{
        nmsa_link("$3-$4", $1);
    }gsex;

    $line =~ s{(Chapter\s+)(\d+)(\s+NMSA)}{
           $1 . nmsa_link($2) . $3
    }gex;

    return $line;
}

sub nmsa_link {
    my $nmsa = shift;
    my $text = shift || $nmsa;

    if ($nmsa =~ /^(\d+)-(\d+\w?)-(\d+)\.(\d+)$/) {
        my ($chapter, $article, $section, $dot) = ($1, lc($2), $3, $4);
        my $Article = $2;  # preserve upper case
        return "<b><a href=\"https://law.justia.com/codes/new-mexico/2021/chapter-$chapter/article-$article/section-$chapter-$article-$section-$dot\" target=\"_blank\">$text</a></b>";
    }

    if ($nmsa =~ /^(\d+)-(\d+\w?)-(\d+)$/) {
        my ($chapter, $article, $section) = ($1, lc($2), $3);
        my $Article = $2;  # preserve upper case
        return "<b><a href=\"https://law.justia.com/codes/new-mexico/2021/chapter-$chapter/article-$article/section-$chapter-$article-$section\" target=\"_blank\">$text</a></b>";
    }

    if ($nmsa =~ /^(\d+)-(\d+\w?)$/) {
        my ($chapter, $article) = ($1, lc($2));
        my $Article = $2;  # preserve upper case
        return "<b><a href=\"https://law.justia.com/codes/new-mexico/2021/chapter-$chapter/article-$article\" target=\"_blank\">$text</a></b>";
    }


    # Chapter only
    if ($nmsa =~ /^(\d+)$/) {
        return "<b><a href=\"https://law.justia.com/codes/new-mexico/2021/chapter-$1\" target=\"_blank\">$text</a></b>";
    }

    return $text;
}

# END   bill text handling
###############################################################################

1;
