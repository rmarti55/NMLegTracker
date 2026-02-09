package NMLegis::UI::Controller::Trackers;
use Mojo::Base 'Mojolicious::Controller', -signatures;

###########
#  index  #  Top-level overview, shows all trackers
###########
sub index ($self) {
    # FIXME: /trackers/my => edit tracker names and access levels?
    my @trackers;
    if ($self->user) {
        # This returns a LoL, with each list of the form ['label', tracker(s)]
        @trackers = $self->db->trackers('all_accessible_by' => $self->user->id);
    }
    else {
        @trackers = [ 'public', $self->db->trackers(is_public => 1) ];
    }

    # add friendlier names
    my %relabel = (
        owned     => 'Your Trackers',
        can_write => 'Trackers to which you have write access',
        can_read  => 'Trackers to which you have read access',
        public    => 'Public Trackers',
    );
    for my $t (@trackers) {
        if (my $newname = $relabel{$t->[0]}) {
            $t->[0] = $newname;
        }
    }

    $self->render(trackers => \@trackers);
}

#############
#  tracker  #  View one tracker
#############
sub tracker ($self) {
    my $tracker_param = $self->param('tracker');
    my $t = $self->db->tracker($tracker_param)
        or do {
            $self->flash(error => 'Invalid / Nonexistent Tracker');
            return $self->redirect_to('/trackers');
        };

    $t->is_readable_by($self->user)
        or do {
            $self->flash(error => 'You do not have access to this tracker');
            return $self->redirect_to('/trackers');
        };

    # Used in watch_button templates to eliminate page clutter
    $self->stash('tracker_context' => $t);

    my @bills = $t->bill_list;
    my $schedules = $self->db->hearings(tracker => $t);

    # KLUDGE! This preserves the same ordering as Dick's spreadsheet
    if ($t->name eq 'LWV') {
        @bills = _read_bill_file($self, '/var/www/nmlegis/lwv/bills.txt');
    }

    $self->render(t => $t, bills => \@bills, schedule => $schedules);
}

#########################
#  manage_subscription  #  subscribe or unsubscribe
#########################
sub manage_subscription ($self) {
    if (! $self->user) {
        $self->flash(error => 'You must be logged in to (un)subscribe');
        return $self->redirect_to('/trackers');
    }

    my $tracker_param = $self->param('trackerid');
    my $t = $self->db->tracker($tracker_param)
        or do {
            $self->flash(error => 'Invalid / Nonexistent Tracker');
            return $self->redirect_to('/trackers');
        };

    $t->is_readable_by($self->user)
        or do {
            $self->flash(error => 'You do not have access to this tracker');
            return $self->redirect_to('/trackers');
        };

    my $urlbase = $self->req->url->path;
    if ($urlbase =~ m!/subscribe$!) {
        $t->subscribe($self->user->id);
    }
    elsif ($urlbase =~ m!/unsubscribe$!) {
        $t->unsubscribe($self->user->id);
    }
    else {
        $self->flash(error => 'WEIRD INTERNAL ERROR!');
        return $self->redirect_to('/trackers');
    }

    return $self->redirect_to($t->url);
}

#####################
#  manage_tracking  #  start or stop tracking a bill
#####################
sub manage_tracking ($self) {
    if (! $self->user) {
        $self->flash(error => 'You must be logged in to (un)subscribe');
        return $self->redirect_to('/trackers');
    }

    my $tracker_param = $self->param('trackerid');
    my $t = $self->db->tracker($tracker_param)
        or do {
            $self->flash(error => 'Invalid / Nonexistent Tracker');
            return $self->redirect_to('/trackers');
        };

    $t->is_writable_by($self->user)
        or do {
            $self->flash(error => 'You do not have access to this tracker');
            return $self->redirect_to('/trackers');
        };

    my $bill_param = $self->param('billid');
    my $b = $self->db->bill($bill_param)
        or do {
            $self->flash(error => 'Invalid / Nonexistent Bill');
            return $self->redirect_to('/trackers');
        };

    my $action = $self->param('action');
    if ($action eq 'track') {
        # FIXME: message, not error
        $self->flash(error => "You are now tracking this bill");
        $t->add($b, $self->user->id)
    }
    elsif ($action eq 'untrack') {
        # FIXME: message, not error
        $self->flash(error => "You are no longer tracking this bill");
        $t->remove($b, $self->user->id)
    }
    else {
        $self->flash(error => 'Invalid / Nonexistent Bill');
        return $self->redirect_to($b->url);
    }

    return $self->redirect_to($b->url);
}


##########
#  edit  #
##########
sub edit ($self) {
    $self->user
        or do {
            $self->flash(error => 'You must be logged in to edit trackers');
            return $self->redirect_to('/login');
        };

    my $tracker_param = $self->param('tracker')
        or do {
            $self->flash(error => 'Which tracker do you want to edit?');
            return $self->redirect_to('/trackers');
        };

    my $t = $self->db->tracker($tracker_param)
        or do {
            $self->flash(error => 'Invalid / Nonexistent Tracker');
            return $self->redirect_to('/trackers');
        };

    $t->is_writable_by($self->user)
        or do {
            $self->flash(error => 'You do not have write access to this tracker');
            return $self->redirect_to('/trackers');
        };

    my @bills = $t->bill_list;
    # FIXME: reorganize? Or leave as-is?
    # FIXME: extract list of categories?

    $self->render(t => $t, bills => \@bills);
}

##################
#  process_edit  #  called via POST
##################
sub process_edit ($self) {
    # FIXME! REFACTOR AUTH CHECKS! FROM HERE...
    $self->user
        or do {
            $self->flash(error => 'You must be logged in to edit trackers');
            return $self->redirect_to('/trackers');
        };

    my $tracker_param = $self->param('tracker')
        or do {
            $self->flash(error => 'Which tracker do you want to edit?');
            return $self->redirect_to('/trackers');
        };

    my $t = $self->db->tracker($tracker_param)
        or do {
            $self->flash(error => "Invalid / Nonexistent Tracker '$tracker_param'");
            return $self->redirect_to('/trackers');
        };

    $t->is_writable_by($self->user)
        or do {
            $self->flash(error => 'You do not have write access to this tracker');
            return $self->redirect_to('/trackers');
        };
    # FIXME! REFACTOR AUTH CHECKS! DOWN TO HERE

    # Privacy and name changes
    my $v = $self->validation;
    $v->optional('is_public')->num(0,1);
    $v->optional('name','trim')->size(1,15)->like(qr/^[A-Za-z0-9]+$/);
    $v->optional('description','trim')->size(1,40)->like(qr/^[\w\s\'\"\!\@\(\)_\+=-]+$/);
    $v->optional('website','trim', 'not_empty')->size(0,99)->like(qr!^(https://)?\S+\.\S+$!);

    if ($v->has_error) {
        use Data::Dump; dd "VALIDATION ERRORS", $v->failed;
        $self->flash(error => "Sorry, I don't like one of your params");
        return $self->render('trackers/edit', t => $t, bills => [$t->bill_list]);
    }

    my $new_is_public = $v->param('is_public') || 0;
    if ($new_is_public =~ /^(0|1)$/ && $1 != $t->is_public) {
        $t->set_public($1);
    }

    if (my $name_param = $v->param('name')) {
        if ($name_param ne $t->name) {
            my $ok = $t->set_name($name_param);
            if ($ok ne 'ok') {
                $self->flash(error => $ok);
                return $self->render('trackers/edit', t => $t, bills => [$t->bill_list]);
            }
        }
    }

    if (my $description_param = $v->param('description')) {
        if ($description_param ne $t->description) {
            my $ok = $t->set_description($description_param);
            if ($ok ne 'ok') {
                $self->flash(error => $ok);
                return $self->render('trackers/edit', t => $t, bills => [$t->bill_list]);
            }
        }
    }

    # Ugh, time to refactor
    my $website_param = $v->param('website') || '';
    if ($website_param) {
        $website_param = 'https://' . $website_param
            unless $website_param =~ m!^https?://!;
    }
    if ($website_param ne ($t->website||'')) {
        my $ok = $t->set_website($website_param);
        if ($ok ne 'ok') {
            $self->flash(error => $ok);
            return $self->render('trackers/edit', t => $t, bills => [$t->bill_list]);
        }
    }

#    use Data::Dump; dd $self->req->params->to_hash;

    my @bills = $t->bill_list;
    for my $row (@bills) {
        my $category = shift @$row;

      BILL:
        for my $b (@$row) {
            my $b_id = $b->id;
            my $b_name = $b->name;
            my $watching = $self->param("watching-$b_id") || 0;
            my $oppose = $self->param("opposed-$b_id") || 0;
            my $new_category = $self->param("category-$b_id") || '';
            my $cat_override = $self->param("category-$b_id-override") || '';

            # Override widget: https://codepen.io/MartinPiccolin/pen/WoNRyM
#            printf "[ %s  cat='%s'  new='%s' '%s' ]\n", $b_name, $category, $new_category, $cat_override;

            # No need to check "if watching", because no new bills
            # can appear here.
            if (! $watching) {
                print ">>>>>>>> $b_name : STOP WATCHING\n";
                $t->remove($b, $self->user->id);
                # No point in checking oppose or category
                next BILL;
            }

            # Check if oppose changes
            if (my $watching = $self->user->is_watching($b)) {
                if (my $watch_status = $watching->{$t->name}) {
                    my $old_oppose = ($watch_status < 0);
                    if ($oppose != $old_oppose) {
                        $t->update($b, $self->user->id, oppose => $oppose);
                    }
                }
            }

            # 2025-02-22 cool text form override for select
            if ($cat_override) {
                if ((! $new_category) || ($new_category eq $category)) {
                    $new_category = $cat_override;
                }
            }

            if ($new_category ne $category) {
                $t->update($b, $self->user->id, category => $new_category);
            }
        }
    }

    $self->redirect_to("/trackers/" . lc($t->name));
}

############
#  update  #  via PUT: process one addition/removal
############
sub update ($self) {
    if (! $self->user) {
        return $self->render(json => { error => 'Not logged in' }, status => 401);
    }

    my $id = $self->param('id')
        or return $self->render(json => { error => 'request with no id' }, status => 400);
    my $is_watching = $self->param('is_watching')
        or return $self->render(json => { error => 'request with no is_watching' }, status => 400);

    $id =~ /^watch-(\d+)-(\d+)$/
        or return $self->render(json => { error => 'invalid watch ID' }, status => 400);
    my ($trackerid, $billid) = ($1, $2);

#    print "  >>>>>>>>> $trackername   $billname  ($is_watching)\n";

    my $tracker = $self->db->tracker($trackerid)
        or return $self->render(json => { error => 'No such tracker' }, status => 400);
    my $bill = $self->db->bill($billid)
        or return $self->render(json => { error => 'No such bill' }, status => 400);

    my $action;
    if ($is_watching =~ /true/) {
        # remove from tracker
        $tracker->remove($bill, $self->user->id)
            or return $self->render(json => { error => 'Internal error updating' }, status => 500);
        $action = 'removed';
    }
    else {
        # add to tracker
        $tracker->add($bill, $self->user->id)
            or return $self->render(json => { error => 'Internal error updating' }, status => 500);
        $action = 'added';
    }

    $self->render(json => { action => $action });
}


###############################################################################
# BEGIN LWV special case

#####################
#  _read_bill_file  #  Special kludge for LWV tracker, maintained elsewhere
#####################
#
# This only works because the LWV tracker is maintained by Dick Mason,
# who emails a .doc file all the time, and my scripts convert that to
# a .txt file which then gets shoved into the DB. No user actually has
# write or update access to the LWV tracker in the DB.
#
sub _read_bill_file ($self, $path) {
    my @bills;

    open my $fh, '<', $path
        or do {
            warn "could not read bill file $path: $!";
            return;
        };

    while (my $line = <$fh>) {
        chomp $line;
        #              12   2      13 3 4   5    54
        if ($line =~ /^((H|S)\w+\d+)(-)?(\s+(\S.*))?/) {        # bill
            push @{$bills[-1]}, $self->db->bill($1);
        }
        elsif ($line) {
            push @bills, [ $line ];
        }
    }
    close $fh;

    return @bills;
}

# END   LWV special case
###############################################################################

1;
