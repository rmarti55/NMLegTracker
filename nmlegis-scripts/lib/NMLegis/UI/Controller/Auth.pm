package NMLegis::UI::Controller::Auth;
use Mojo::Base 'Mojolicious::Controller', -signatures;

use Crypt::PBKDF2;
use Crypt::PRNG         qw(random_bytes_b64);

sub login_form ($self) {
    if ($self->session('userid')) {
        # FIXME: what's a good way to handle this?
        $self->flash(error => 'You\'re already logged in');
        $self->redirect_to('/');
    }

    # Try to take user back to the page they came from
    if (my $referer = $self->param('referer') || $self->req->headers->referer) {
        $self->stash(referer => $referer);
    }

    $self->render();
}

# POST
sub login ($self) {
    my $email          = $self->param('email');
    my $given_password = $self->param('password');

    my $redirect_to = $self->param('referer')
        || $self->stash('referer');
    undef $redirect_to if $redirect_to =~ m!/reset!;

    my $dbix = $self->app->db->{_dbix};
    $dbix->query("SELECT id, password FROM users WHERE email=? COLLATE NOCASE", $email)->into(my ($userid, $hashed_password));

    my $pbkdf2 = Crypt::PBKDF2->new;
    if ($email && $hashed_password && $pbkdf2->validate($hashed_password, $given_password)) {
        $self->session(userid => $userid);
        $self->session(expiration => 86400 * 365 * 2);
        $self->redirect_to($redirect_to || '/trackers');
    } else {
        $self->stash(error => 'Invalid email or password');
        $self->stash(referer => $redirect_to);
        $self->render('auth/login_form');
    }
}

###############################################################################
# BEGIN password reset

################
#  reset_form  #  Linked to from /login; form asking for email address
################
sub reset_form ($self) {
    if ($self->session('userid')) {
        # FIXME: what's a good way to handle this?
        $self->flash(error => 'You\'re already logged in');
        $self->redirect_to('/');
    }

    $self->render();
}

###########
#  reset  #  Main action handler
###########
#
# Two ways to call this:
#   1) as the POST handler for reset_form() : accepts an email address,
#      sends the reset email; or
#   2) as the handler for a successful reset : accepts a token, resets passwd
#
sub reset ($self) {
    # If called with a token param, delegate below
    return process_reset($self) if $self->param('token');

    # No token. This is the destination of the first reset form. We should
    # have an email address.
    my $email = $self->param('email')
        or do {
            $self->stash(error => 'Please fill in your email address');
            return reset_form($self);
        };

    # Look up email address. If it's valid, generate a token and email it.
    # Do not leak information: if email is not valid, issue the same page.
    my $dbix = $self->app->db->{_dbix};
    $dbix->query("SELECT id FROM users WHERE email=? COLLATE NOCASE", $email)->into(my $userid);

    if ($userid) {
        # generate 16-byte random string. Strip non-alphanum.
        my $token = random_bytes_b64(16);
        $token =~ s/=+$//;
        $token =~ s/[^a-zA-Z0-9]/x/g;

        # store it in DB along with timestamp, userid
        $dbix->query('INSERT INTO reset_tokens VALUES (??)', $token, $userid, time);

        # send email to user
        $self->app->plugin('SendEmail' => {
            from => '"NMLegisWatch Password Reset" <noreply@nmlegiswatch.org>',
            host => '127.0.0.1',
            port => 25,
        });

        # GAH! There has to be a better way to get the actual user-visible URL!
        my $url = $self->req->url->to_abs . '/' . $token;
        $url =~ s|http\S+localhost:5002|https://nmlegiswatch.org|;

        $self->send_email(
            to       => $email,
            subject  => "NMLegisWatch password reset",
            template => 'auth/reset',
            params   => {
                reset_url => $url,
                token     => $token,
            },
        );

        $self->app->log->warn("password reset request from $email");
    }

    # Render info page. Same page whether or not the email is valid.
    $self->render();
}

###################
#  process_reset  #  Process a successful reset
###################
#
# Two ways to call this:
#   1) The first half: called with a valid token. Show a change-password form.
#   2) Second half: called with token AND new password. Change pw, go to /login
#
sub process_reset ($self) {
    my $token = $self->param('token');

    # validate that token is simple alphanumeric
    $token =~ m!^([a-zA-Z0-9]{22})$!
        or do {
            $self->stash(error => 'invalid token');
            $self->render('auth/reset');
            return;
        };

    # Confirm that it's a real token, in our database
    my $dbix = $self->app->db->{_dbix};
    $dbix->query('SELECT userid,created FROM reset_tokens WHERE token=?', $token)->into(my ($userid, $created));
    if (! $userid) {
        # Not a valid token: go back to reset page
        $self->stash(error => 'Nonexistent token');
        $self->render('auth/reset');
        return;
    }

    # Tokens expire after one hour
    if ($created < time - 3600) {
        $self->flash(error => 'Token expired');
        # Delete it from DB
        $dbix->query('DELETE FROM reset_tokens WHERE token=?', $token);
        $self->redirect_to('/login/reset');
        return;
    }

    # Called with a password? If passwords match, change it
    if (my $pw1 = $self->param('password1')) {
        if (my $pw2 = $self->param('password2')) {
            if ($pw1 eq $pw2) {
                # Success!
                my $hash = Crypt::PBKDF2->new->generate($pw1);
                $dbix->query('UPDATE users SET password=? WHERE id=?', $hash, $userid);

                $self->app->log->warn("successful password reset: $userid");

                # Invalidate this token
                $dbix->query('DELETE FROM reset_tokens WHERE token=?', $token);

                $self->flash(error => 'Password changed. Now please log in.');
                $self->redirect_to('/login');
                return;
            }
        }
        $self->stash(error => 'passwords do not match');
    }

    $self->render('auth/reset_password_form', token => $token);
}

# END   password reset
###############################################################################

#
# Log out
#
sub logout ($self) {
    $self->session(userid => 0);
    $self->redirect_to('/');
}

sub register_form ($self) {
    if ($self->session('userid')) {
        # FIXME: what's a good way to handle this?
        $self->flash(error => 'Um, you\'re already registered and logged in');
        return $self->redirect_to('/');
    }

    $self->render();
}

sub register ($self) {
    my $v = $self->validation;

    return $self->render('auth/register_form')       unless $v->has_data;

    $v->required('email', 'trim')->size(5, 50)->like(qr/^\S+\@\S+\.\S+$/);
    $v->required('password')->size(7,100);
    $v->required('firstname', 'trim')->size(1,30)->like(qr/^\w[\w\s-]+\w$/);
    $v->required('lastname', 'trim')->size(1,30)->like(qr/^\w[\w\s-]+\w$/);
    $v->optional('hdistrict','not_empty', 'trim');        # FIXME! hardcoding
    $v->optional('sdistrict','not_empty', 'trim');        # FIXME! hardcoding

    if ($v->has_error) {
        $self->flash(error => "Please address these errors and try again");
        my @errlist = (error => "Please address these errors and try again");
        if (my $failed = $v->failed) {
            #use Data::Dump; dd $failed;
            for my $field (@$failed) {
                my ($check, $result, @args) = @{ $v->error($field) };
                my $err = 'Invalid input';
                if ($check eq 'size') {
                    $err = "Must be $args[0]-$args[1] characters";
                }
                elsif ($check eq 'like') {
                    $err = 'Invalid input';
                }
                elsif ($check eq 'num') {
                    $err = 'Invalid number';
                }
                else {
                    warn "Hey Ed, FIXME, unknown check '$check' for $field";
                }
                # For Ed to debug
                warn "Registration failure: $field -> $err";
                push @errlist, "${field}_errors" => $err;
            }
        }
        return $self->render('auth/register_form', @errlist);
    }

    my $firstname      = $v->param('firstname');
    my $lastname       = $v->param('lastname');
    my $email          = $v->param('email');

    # Probably spammers
    return $self->redirect_to('/404') if $email =~ /do-not-respond\.me/;

    $self->app->log->warn("> registration: '$firstname' '$lastname' '$email'\n")
        if -e 'callme';

    # Does user already exist?
    my $dbix = $self->app->db->{_dbix};
    $dbix->query("SELECT id FROM users WHERE email=? COLLATE NOCASE", $email)->into(my ($already_registered));
    if ($already_registered) {
        return $self->render('auth/already_registered');
    }


    my $pbkdf2 = Crypt::PBKDF2->new;
    my $pwhash = $pbkdf2->generate($v->param('password'));

    my @bind = (undef, $v->param('email'), $pwhash,
                map { $v->param($_) } qw(firstname lastname hdistrict sdistrict),
                0);
    $dbix->query("INSERT INTO users VALUES (??)", @bind);

    my $userid = $dbix->last_insert_id;
    $self->session(userid => $userid);
    $self->session(expiration => 86400 * 365 * 2);

    # Every new user gets a tracker
    my @trackernameoptions = ($firstname,
                              sprintf("%s%1.1s", $firstname, $lastname),
                              map { "${firstname}$_" } qw(1..10),
                              "$firstname$lastname"
                          );
    for my $tname (@trackernameoptions) {
        $dbix->query('SELECT id FROM trackers WHERE name=? COLLATE NOCASE', $tname)->into(my $found);
        if (! $found) {
            $dbix->query('INSERT INTO trackers VALUES (??)',
                         undef, $tname, "$firstname $lastname",
                         $self->user->id, 0, undef);
            return $self->render(tracker => $tname);
        }
    }

    # FIXME! ERROR!
}


1;
