package NMLegis::UI::Controller::Search;
use Mojo::Base 'Mojolicious::Controller', -signatures;

use NMLegis;
use NMLegis::Bills;
use NMLegis::Legislators;
use Unicode::Collate;

sub search ($self) {
    my $q = $self->param('q');

    # Specific bill, ...
    if ($q =~ /^\s*(H|S)\s*([A-Z]{1,5})\s*(\d+)\s*$/i) {
        my $billno = uc("$1$2$3");
        if ($self->db->bill($billno)) {
            $self->redirect_to("/bills/$billno");
        }
    }

    # ...or legislator or committee.
    if ($q =~ /^(H|S)([A-Z]{2,7})$/i) {
        if (my $l = eval { $self->db->legislator(uc($q)) }) {
            $self->redirect_to($l->url);
        }
        if (my $c = eval { $self->db->committee(uc($q)) }) {
            $self->redirect_to($c->url);
        }
    }

    # Nope. Do an actual search
    my @q = split ' ', $q;

    # Try to match bills, legislators, committees
    my @bills_by_title = $self->_search_bill_titles(@q);
    my @bills_by_blurb = $self->_search_bill_blurbs(@q);
    my @legislators = $self->_search_legislators(@q);

    # Bills by blurb will always be a superset of by title
    if (@bills_by_blurb == 1 && !@legislators) {
        $self->redirect_to(sprintf("/bills/%s", $bills_by_blurb[0]->code));
    }

    if (@legislators == 1 && !@bills_by_blurb) {
        $self->redirect_to(sprintf("/legislators/%s", $legislators[0]->code));
    }

    # Nothing, or perhaps more than one match.

    # Reduce the blurb list
    my @reduced_bills_by_blurb;
    for my $b (@bills_by_blurb) {
        if (! grep { $_->id == $b->id } @bills_by_title) {
            push @reduced_bills_by_blurb, $b;
        }
    }

    $self->render(q => $q, bills_by_title => \@bills_by_title, bills_by_blurb => \@reduced_bills_by_blurb, legislators => \@legislators);
}

sub _search_bill_titles ($self, @terms) {
    my @bills = $self->db->bills;
    for my $term (@terms) {
        @bills = grep { $_->title =~ /$term/i } @bills;
        return if !@bills;
    }

    return @bills;
}

sub _search_bill_blurbs ($self, @terms) {
    my @bills = $self->db->bills;
    for my $term (@terms) {
        @bills = grep { $_->title =~ /$term/i || $_->blurb =~ /$term/i } @bills;
        return if !@bills;
    }

    return @bills;
}


sub _search_legislators ($self, @terms) {
    # https://stackoverflow.com/questions/5157141/how-do-you-match-accented-and-tilde-characters-in-a-perl-regular-expression-reg
    my $collate = new Unicode::Collate::
        level         => 1,
        normalization => undef
        ;

    my @legislators = $self->db->legislators;
    for my $term (@terms) {
        @legislators = grep { $collate->gmatch($_->name, $term) } @legislators;
        return if !@legislators;
    }

    return @legislators;
}





1;
