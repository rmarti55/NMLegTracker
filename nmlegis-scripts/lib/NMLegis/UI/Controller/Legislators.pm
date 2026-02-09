package NMLegis::UI::Controller::Legislators;
use Mojo::Base 'Mojolicious::Controller', -signatures;

use NMLegis;
use NMLegis::UI::Model::DB;

# List of all legislators
sub index ($self) {
    my @all = $self->db->legislators;

    $self->render(legislators => \@all);
}

# One legislator
sub legislator ($self) {
    my $code = uc($self->param('legislator'));

    # Canonicalize
    $code =~ s/\.HTML$//;

    # Verify that it's a valid legislator
    my $l = eval { $self->db->legislator($code) }
        or do {
            warn "warning: user fed us '$code' as legislator, ignoring";
            $self->flash(error => "Invalid/unknown legislator");
            warn "Invalid legislator param '$code'";
            return $self->redirect_to('/legislators');
        };

    # Redirect to canonical URL
    if ($l->code ne $self->param('legislator')) {
        return $self->redirect_to($l->url);
    }

    $self->render(l => $l);
}

1;
