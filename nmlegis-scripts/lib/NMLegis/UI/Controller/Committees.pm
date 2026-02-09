package NMLegis::UI::Controller::Committees;
use Mojo::Base 'Mojolicious::Controller', -signatures;

use NMLegis;

use Date::Parse;
use Time::Piece;

# This action will render a template
sub index ($self) {
    my @all = $self->db->committees;

    # Render template "example/welcome.html.ep" with message
    $self->render(committees => \@all);
}

sub committee ($self) {
    my $code = uc($self->param('committee'));

    # Canonicalize
    $code =~ s/\.HTML$//;
    if ($code =~ /^(HOUSE|SENATE)$/) {
        # Canonical URL is just /House and /Senate, without /committee
        my $normalized = ucfirst(lc($code));
        if ($normalized ne $self->param('committee')) {
            return $self->redirect_to("/$normalized");
        }
        $code = $normalized;
    }

    # Special case for Rules committees. Their official codes include 'X'
    # but in bill status codes they are listed without the X.
    $code = 'HXRC' if $code eq 'HRC';
    $code = 'SXCC' if $code eq 'SCC';

    # Verify valid committee
    my $committee = eval { $self->db->committee($code) }
        or do {
            warn "warning: user fed us '$code' as committee, ignoring";
            $self->flash(error => "Invalid/unknown committee");
            warn "Invalid committee param '$code'";
            return $self->redirect_to('/committees');
        };

    # Redirect to canonical URL, eg /h123.html -> /H123
    if ($committee->code ne $self->param('committee')) {
        return $self->redirect_to("/committees/" . $committee->code);
    }

    my $schedules = $self->db->hearings($code);

    $self->stash('omit_committee_title' => 1);
    $self->render(committee => $committee, schedule => $schedules);
}

sub schedules ($self) {
    my $schedules = $self->db->hearings();

    $self->render(schedule => $schedules);
}

1;
