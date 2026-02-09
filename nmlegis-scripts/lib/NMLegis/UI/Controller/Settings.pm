package NMLegis::UI::Controller::Settings;
use Mojo::Base 'Mojolicious::Controller', -signatures;

use Crypt::PBKDF2;

sub index ($self) {
    $self->user
        or do {
            $self->flash(error => 'Settings page only available when logged in');
            return $self->redirect_to('/login');
        };

    $self->render(changelog => []);
}

sub update ($self) {
    $self->user
        or return $self->render('error', 'need to be logged in');

    my @changelog;

    for my $k (qw(firstname lastname hdistrict sdistrict password)) {
        my $old = $self->user->get($k);
        my $new = $self->param($k) || '';
        next unless $new && ($new ne $old);

        # FIXME: copy validators from Auth.pm


        if ($k eq 'password') {
            $new = Crypt::PBKDF2->new->generate($new);
        }

        $self->user->set($k, $new);
        push @changelog, "Updated $k";
    }

    # FIXME: add a flash? Message? Something?
    $self->render(template => 'settings/index', changelog => \@changelog);
}

1;
