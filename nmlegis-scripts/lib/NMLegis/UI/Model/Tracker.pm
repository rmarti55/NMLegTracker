# -*- perl -*-

package NMLegis::UI::Model::Tracker;

use NMLegis::UI::Model::Bill;
use NMLegis::UI::Model::DB;

use strict;
use warnings;
use experimental qw(signatures);

use Carp;
use List::Util          qw(uniq);
use Time::Piece;

###############################################################################
# It's just easier to define this as a global

our $DBIx;

###############################################################################
# BEGIN constructors called from DB

sub find($class, $dbix, @args) {
    $DBIx //= $dbix;

    my ($query, @bind);

    if (! @args) {
        # all
        $query = <<'END_SQL';
SELECT * FROM trackers ORDER BY name
END_SQL
    }

    # One arg: ...
    if (@args == 1) {
        # If arg is entirely numeric, assume it's ID.
        my $what = 'id';
        if ($args[0] =~ /\D/) {
            # Contains non-numbers. It's a name.
            $what = 'name';
        }
        $query = "SELECT * FROM trackers WHERE $what = ? COLLATE NOCASE";
        @bind = @args;
    }

    # Two args: treat as "field == value"
    if (@args == 2) {
        my ($field, $value) = @args;
        if (my $handler = __PACKAGE__->can("_find_by_$field")) {
            ($query, @bind) = $handler->($value);
        } elsif ($field eq 'all_accessible_by') {
            # this returns a list
            return _find_all_accessible_by($class, $dbix, $value);
        }
    }

    croak "cannot find tracker matching '@args'" if !$query;

    return map { bless $_, $class } $DBIx->query($query, @bind)->hashes;
}

sub _find_by_owner ($bind) {
    return (<<'END_SQL', $bind);
SELECT t.id AS id, t.name AS name, t.description AS description
       FROM trackers t INNER JOIN users u ON t.owner == u.id
       WHERE t.owner == ?
       ORDER BY name
END_SQL
}

sub _find_by_can_write ($bind) {
    return (<<'END_SQL', $bind);
SELECT * FROM trackers t JOIN tracker_access ta ON t.id == ta.trackerid
       WHERE ta.userid == ?
       AND ta.access == 'w'
       ORDER BY name
END_SQL
}

sub _find_by_can_read ($bind) {
    return (<<'END_SQL', $bind);
SELECT * FROM trackers t JOIN tracker_access ta ON t.id == ta.trackerid
       WHERE ta.userid == ?
       AND ta.access != ''
       ORDER BY name
END_SQL
}

sub _find_by_is_public ($bind) {
    return ('SELECT * FROM trackers WHERE is_public == ? ORDER BY name', $bind);
}

#########################
#  _find_by_subscribed  #  trackers that a user is subscribed to
#########################
#
# NOTE: Users cannot unsubscribe from trackers they own! This may
# be a mistake, maybe we have to rethink that later.
#
sub _find_by_subscribed ($bind) {
    # FIXME: this does not do access checking
    return (<<'END_SQL', $bind, $bind);
SELECT t.id, t.name, t.description, t.owner, t.is_public
       FROM trackers t
       WHERE owner=?
       UNION
    SELECT t.id, t.name, t.description, t.owner, t.is_public
       FROM trackers t JOIN tracker_access ta ON t.id==ta.trackerid
       WHERE ta.userid==? AND ta.subscribed=1;
END_SQL
}

sub _find_all_accessible_by ($class, $dbix, $userid) {
    $userid = $userid->{id} if ref($userid);

    my @trackers;
    my %seen;
    if ($userid) {
        my @t;
        if (@t = find($class, $dbix, owner => $userid )) {
            push @trackers, [ 'owned', @t ];
            %seen = map { $_->id => 1 } @t;
        }
        if (@t = find($class, $dbix, can_write => $userid )) {
            if (@t = grep { ! $seen{ $_->id }++ } @t) {
                push @trackers, [ 'can_write', @t ];
            }
        }
        if (@t = find($class, $dbix, can_read => $userid )) {
            if (@t = grep { ! $seen{ $_->id }++ } @t) {
                push @trackers, [ 'can_read', @t ];
            }
        }
    }

    if (my @public = find($class, $dbix, is_public => 1)) {
        if (@public = grep { ! $seen{ $_->id }++ } @public) {
            push @trackers, [ 'public', @public ];
        }
    }

    return @trackers;
}

# END   constructors called from DB
###############################################################################
# BEGIN custom accessors

sub url ($self) {
    return sprintf("/trackers/%s", lc($self->name));
}

sub bill_list ($self) {
    # FIXME FIXME FIXME! Hardcoded session!
    my @all = $DBIx->query(<<'END_SQL', $self->id, 2026)->hashes;
SELECT * FROM tracked t LEFT JOIN bills b ON t.billid == b.id
    WHERE t.trackerid == ?
      AND b.session == ?
END_SQL

    # Organize by category
    my %by_category;
    for my $tuple (@all) {
        push @{ $by_category{ $tuple->{category} || 'Uncategorized' } },
            NMLegis::UI::Model::Bill->find($DBIx, billid => $tuple->{billid});
    }

    # Reorganize
    my @as_list;
    for my $category (sort keys %by_category) {
        push @as_list, [ $category, sort _by_bill @{$by_category{$category}} ];
    }

    return @as_list;
}

# FIXME FIXME FIXME! This does not belong here!
sub _by_bill {
    $a->chamber cmp $b->chamber
        || $a->type cmp $b->type
        || $a->number <=> $b->number;
}

####################
#  is_readable_by  #  Can remote user (possibly anon) read this tracker?
####################
sub is_readable_by ($self, $user) {
    # Public tracker is always readable
    return 1 if $self->is_public;

    # Also if owned by ourself
    my $userid = 0;
    if (ref($user)) {
        $userid = $user->id;
    }
    elsif (defined($user) && $user =~ /^(\d+)$/) {
        $userid = $1;
    }
    else {
        carp "WEIRD: unknown user param '$user' to is_readable_by";
        return;
    }
    return 1 if $self->owner == $userid;

    # Not public, nor owned by user. Check for permission
    my @access = $DBIx->query(<<'END_SQL', $self->id, $userid)->flat;
SELECT access FROM tracker_access WHERE trackerid=? AND userid=?
END_SQL
#    use Data::Dump; dd \@access;
    if (@access) {
        if ($access[0]) {
            return 1;
        }
    }
    return;
}

####################
#  is_writable_by  #  Does remote user (possibly anon) have write access?
####################
sub is_writable_by ($self, $user) {
    # Always writable if owned by ourself
    my $userid = 0;
    if (ref($user)) {
        $userid = $user->id;
    }
    elsif (defined($user) && $user =~ /^(\d+)$/) {
        $userid = $1;
    }
    else {
        carp "WEIRD: unknown user param '$user' to is_writable_by";
        return;
    }
    return 1 if $self->owner == $userid;

    # Not owned by user. Check for permission
    my @access = $DBIx->query(<<'END_SQL', $self->id, $userid)->flat;
SELECT access FROM tracker_access WHERE trackerid=? AND userid=?
END_SQL
#    use Data::Dump; dd \@access;
    if (@access) {
        if (($access[0]||'') eq 'w') {
            return 1;
        }
    }

    return;
}

#########################
#  is_subscribed_to_by  #  Is the given remote user subscribed to this tracker?
#########################
sub is_subscribed_to_by ($self, $user) {
    my $userid = 0;
    if (ref($user)) {
        $userid = $user->id;
    }
    elsif (defined($user) && $user =~ /^(\d+)$/) {
        $userid = $1;
    }
    else {
        carp "WEIRD: unknown user param '$user' to is_subscribed_to_by";
        return;
    }

    $DBIx->query(<<'END_SQL', $self->id, $userid)->into(my $subscribed);
SELECT subscribed FROM tracker_access
 WHERE trackerid=?
   AND userid=?
END_SQL

    return $subscribed;
}

#################
#  subscribers  #  List of users subscribed to this tracker
#################
sub subscribers ($self) {
    my @subscriber_ids = ( $self->owner );

    push @subscriber_ids, $DBIx->query(<<'END_SQL', $self->id)->flat;
SELECT userid FROM tracker_access
 WHERE trackerid=?
   AND subscribed=1
END_SQL

    my $db = NMLegis::UI::Model::DB->new;
    my @subscribers;
    for my $s (uniq @subscriber_ids) {
        push @subscribers, $db->user($s);
    }
    #use Data::Dump; dd \@subscribers;

    return @subscribers;
}

###############
#  subscribe  #  Subscribe a user
###############
sub subscribe ($self, $user) {
    my $userid = 0;
    if (ref($user)) {
        $userid = $user->id;
    }
    elsif (defined($user) && $user =~ /^(\d+)$/) {
        $userid = $1;
    }
    else {
        carp "WEIRD: unknown user param '$user' to is_subscribed_to_by";
        return;
    }

    my @found = $DBIx->query(<<'END_SQL', $self->id, $userid)->hashes;
SELECT * FROM tracker_access
 WHERE trackerid=?
   AND userid=?
END_SQL
    if (@found) {
        $DBIx->query(<<'END_SQL', 1, $self->id, $userid);
UPDATE tracker_access
   SET subscribed=?
 WHERE trackerid=?
   AND userid=?
END_SQL
    }
    else {
        $DBIx->query(<<'END_SQL', $self->id, $userid, '', 1);
INSERT INTO tracker_access VALUES (??)
END_SQL
    }
}

#################
#  unsubscribe  #  Unsubscribe a user
#################
sub unsubscribe ($self, $user) {
    my $userid = 0;
    if (ref($user)) {
        $userid = $user->id;
    }
    elsif (defined($user) && $user =~ /^(\d+)$/) {
        $userid = $1;
    }
    else {
        carp "WEIRD: unknown user param '$user' to is_subscribed_to_by";
        return;
    }

    my @found = $DBIx->query(<<'END_SQL', $self->id, $userid)->hashes;
SELECT * FROM tracker_access
 WHERE trackerid=?
   AND userid=?
END_SQL
    if (@found) {
        $DBIx->query(<<'END_SQL', 0, $self->id, $userid);
UPDATE tracker_access
   SET subscribed=?
 WHERE trackerid=?
   AND userid=?
END_SQL
    }
    else {
        # WEIRD!!!!! How can we call unsubscribe when there was never a row?
    }
}

#############
#  history  #
#############
sub history ($self) {
    my $YYYY = 2026;            # FIXME: hardcoded session
    my @history = $DBIx->query(<<'END_SQL', $self->id, $YYYY)->hashes;
SELECT * FROM tracking_history th
  JOIN users u ON th.userid == u.id
  JOIN bills b ON th.billid == b.id
    WHERE trackerid=?
      AND b.session=?
    ORDER BY timestamp DESC
END_SQL

    # FIXME: does our caller really need this?
    for my $record (@history) {
        ($record->{bill}) = NMLegis::UI::Model::Bill->find($DBIx, billid => $record->{billid});
        $record->{lt} = localtime($record->{timestamp});
    }

    @history;
}

# END   custom accessors
###############################################################################
# BEGIN actions

# invoked via PUT. Caller does all auth checks.
sub add ($self, $bill, $userid) {
    return if !$userid;

    $DBIx->query('INSERT INTO tracked VALUES (??)', $self->id, $bill->id, '', 0);

    # Assume that an undo within a few seconds was an accident and
    # neither should be logged
    if (my $cat = $self->_undo_oopsie($bill, $userid, 'Stopped tracking')) {
        # It was an oops. Try to recover original category.
        $DBIx->query(<<'END_SQL', $cat, $self->id, $bill->id);
UPDATE tracked SET category=?
 WHERE trackerid=?
   AND billid=?
END_SQL
    }
    else {
        # Not an oops. Make a history entry.
        $DBIx->query(<<'END_SQL', undef, time, $userid, $self->id, $bill->id, "Started tracking") if $userid;
INSERT INTO tracking_history VALUES (??)
END_SQL
    }

    return 1;
}

sub remove ($self, $bill, $userid) {
    # Preserve category
    $DBIx->query(<<'END_SQL', $self->id, $bill->id)->into(my $category);
SELECT category FROM tracked WHERE trackerid=? AND billid=?
END_SQL

    $DBIx->query(<<'END_SQL', $self->id, $bill->id);
DELETE FROM tracked WHERE trackerid=? AND billid=?
END_SQL

    # Assume that an undo within a few seconds was an accident and
    # neither should be logged
    unless ($self->_undo_oopsie($bill, $userid, 'Started tracking')) {
        my $msg = "Stopped tracking";
        $msg .= " (category was $category)" if $category;
        $DBIx->query(<<'END_SQL', undef, time, $userid, $self->id, $bill->id, $msg);
INSERT INTO tracking_history VALUES (??)
END_SQL
    }

    return 1;
}

sub update ($self, $bill, $userid, $field, $new_value) {
    my $sql = <<"END_SQL";
UPDATE tracked SET $field=?
 WHERE trackerid=?
   AND billid=?
END_SQL

    $DBIx->query($sql, $new_value, $self->id, $bill->id);
    $DBIx->query(<<'END_SQL', undef, time, $userid, $self->id, $bill->id, "$field -> $new_value");
INSERT INTO tracking_history VALUES (??)
END_SQL
}

sub _undo_oopsie ($self, $bill, $userid, $what) {
    my $sql = <<'END_SQL';
       SELECT * FROM tracking_history
       WHERE userid=?
         AND trackerid=?
         AND billid=?
         AND timestamp > ?
         AND comment LIKE ?
END_SQL

    my @bind = ($userid, $self->id, $bill->id, time - 30, "$what%");
    if (my @match = $DBIx->query($sql, @bind)->hashes) {
        $DBIx->query("DELETE FROM tracking_history WHERE id=?", $match[0]{id});
        if ($match[0]{comment} =~ /category was (.*)\)/) {
            return $1;
        }
        return 'Uncategorized';
    }
    return;
}

################
#  set_public  #
################
sub set_public ($self, $public) {
    my $sql = 'UPDATE trackers SET is_public=? WHERE id=?';
    $DBIx->query($sql, $public, $self->id);
}

sub set_name ($self, $name) {
    $DBIx->query('SELECT name FROM trackers WHERE name=? COLLATE NOCASE', $name)
        ->into(my $exists);
    if ($exists) {
        return "ERROR: that tracker name already exists";
    }

    my $sql = 'UPDATE trackers SET name=? WHERE id=?';
    $DBIx->query($sql, $name, $self->id)
        or return "ERROR: not sure what";

    $self->{name} = $name;
    return 'ok';
}

sub set_description ($self, $description) {
    my $sql = 'UPDATE trackers SET description=? WHERE id=?';
    $DBIx->query($sql, $description, $self->id)
        or return "ERROR: not sure what";

    $self->{description} = $description;
    return 'ok';
}

sub set_website ($self, $website) {
    my $sql = 'UPDATE trackers SET website=? WHERE id=?';
    $DBIx->query($sql, $website, $self->id)
        or return "ERROR: not sure what";

    $self->{website} = $website;
    return 'ok';
}

# END   actions
###############################################################################
# BEGIN standard accessors

sub get ($self, $attr) {
    if (exists $self->{$attr}) {
        return $self->{$attr};
    }
    if (my $handler = $self->can($attr)) {
        return $handler->($self);
    }

    warn "Undefined attr '$attr'";
    return;
}

use vars qw($AUTOLOAD);
sub AUTOLOAD {
    my $self = shift;

    (my $attr = $AUTOLOAD) =~ s/^.*:://;
    $self->get($attr);
}

sub DESTROY {}

# END   accessors
###############################################################################

1;
