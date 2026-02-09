# -*- perl -*-

package NMLegis::UI::Model::User;

use strict;
use warnings;
use experimental qw(signatures);
use Carp;

use NMLegis::UI::Model::DB;

sub new ($class, $app) {
    my $self = bless { _app => $app }, $class;
    $self->_init();
    return $self;
}

sub _init ($self) {
    return if exists $self->{id};
    my $app = $self->{_app}
        or return;
    my $session = $app->session
        or return;
    my $userid = $session->{userid}
        or return;
    $self->{_dbix} = $app->db->{_dbix};

    my $href = $self->{_dbix}->query('SELECT * FROM users WHERE id=?',$userid)->hash;

    $self->{$_} = $href->{$_}   for keys %$href;
#    use Data::Dump; dd $href;

    return $self;
}

sub find($class, $dbix, @args) {
    my ($query, @bind);

    # No args. Return all users.
    if (! @args) {
        $query = 'SELECT * FROM users ORDER BY id';
    }

    # One arg: ...
    if (@args == 1) {
        # If arg is entirely numeric, assume it's ID.
        my $what = 'id';
        if ($args[0] =~ /\D/) {
            # Contains non-numbers. It's a name.
            $what = 'name';
            croak "UNIMPLEMENTED: ->find_user() by name";
        }
        $query = "SELECT * FROM users WHERE $what = ? COLLATE NOCASE";
        @bind = @args;
    }

    # Two args: treat as "field == value"
    if (@args == 2) {
        croak "UNIMPLEMENTED: ->find_user() with 2 args";
    }

    return map { $_->{_dbix} = $dbix; bless $_, $class } $dbix->query($query, @bind)->hashes;
}

######################
#  is_subscribed_to  #  Boolean: is user subscribed to THIS tracker?
######################
sub is_subscribed_to ($self, $t) {
    return unless $self->{id};

    return $t->is_subscribed_to_by($self);
}

############################
#  trackers_subscribed_to  #  Returns list of trackers
############################
sub trackers_subscribed_to ($self) {
    return unless $self->{id};

    my $uidb = $self->{_app}{db} || NMLegis::UI::Model::DB->new;
    $uidb->trackers(subscribed => $self->id);
}

sub trackers_owned ($self) {
    return unless $self->{id};
    my $uidb = $self->{_app}{db} || NMLegis::UI::Model::DB->new;
    $uidb->trackers(owner => $self->id);
}

#################
#  is_watching  #  Returns hashref of trackers subscribed to, and bills
#################
sub is_watching ($self, $bill) {
    return unless $self->{id};

    $self->{_watching} //= do {
        my @subscribed = $self->trackers_subscribed_to;

        my %watching;
        for my $t (@subscribed) {
            # FIXME: hardcoded session!
            my @bills = $self->{_dbix}->query(<<'END_SQL', 2026, $t->id)->arrays;
SELECT b.code,t.oppose FROM bills b JOIN tracked t ON t.billid == b.id
    WHERE b.session   == ?
      AND t.trackerid == ?
END_SQL
            for my $tuple (@bills) {
                my ($billcode, $oppose) = @$tuple;
                # FIXME: we sometimes get undefs. Try to understand.
                if (! defined $billcode) {
                    use Data::Dump; dd "GOT UNDEFS IN IS_WATCHING", \@bills;
                }
                $watching{$billcode}{$t->name} = ($oppose ? -1 : 1);
            }
        }

        \%watching;
    };

    return $self->{_watching}{$bill->code};
}

sub my_legislator ($self, $chamber) {
    $self->_init();
    return unless $self->{id};
    my $district = $self->get(lc($chamber) . 'district')
        or return;
    return $self->{_app}->db->legislator($chamber, $district);
}

sub my_representative ($self) {
    $self->_my_legislator('H');
}

sub my_senator ($self) {
    $self->_my_legislator('S');
}

######################
#  is_my_legislator  #
######################
sub is_my_legislator ($self, $l) {
    $self->_init();
    return unless $self->{id};
    return unless ref($l);
    my $my_district = $self->get(lc($l->chamber) . 'district')
        or return;
    return ($l->district == $my_district);
}

sub is_my_legislator_on_committee($self, $c) {
    $self->_init();
    return unless $self->{id};
    return unless ref($c);
    my $my_district = $self->get(lc($c->chamber) . 'district')
        or return;
    my @match = grep { $_->district == $my_district } $c->members;
    return $match[0];
}

sub get ($self, $field) {
    $self->_init();

    if (exists $self->{$field}) {
        return $self->{$field};
    }

    return 0 if $field eq 'id' || $field =~ /^.district$/;

    warn "No $field\n";
    return;
}

sub set ($self, $field, $newvalue) {
    # FIXME: how to handle nonexistent updates?
    exists $self->{$field}
        or return;

    my $sql = sprintf('UPDATE users SET %s=? WHERE id=?', $field);
    $self->{_dbix}->query($sql, $newvalue, $self->{id});
    $self->{$field} = $newvalue;
}

use vars qw($AUTOLOAD);
sub AUTOLOAD {
    my $self = shift;

    $self->_init();

    (my $attr = $AUTOLOAD) =~ s/^.*:://;
    $self->get($attr);
}

sub DESTROY {}

use overload bool => sub { $_[0]->_init(); exists $_[0]->{id}; };

1;
