# -*- perl -*-
#
# Test the live site
#

use v5.30;
use utf8;
use open qw( :encoding(UTF-8) :std );

use Mojo::Base -strict;

use Test::More;
use Test::Mojo;

my $t = Test::Mojo->new('NMLegis::UI');

for my $standard_url (qw(/ /about /login /register /committees/schedules /trackers /bills /bills/history /bills/pending /bills/signed)) {
    $t->get_ok($standard_url)->status_is(200);
}

# Test every individual legislator page
$t->get_ok("/legislators")->status_is(200);
my @legislators;
$t->tx->result->dom->find('.legislatorname a')->each(sub { push @legislators, $_->{href} });
$t->get_ok($_)  for @legislators;

# ...and committees
$t->get_ok("/committees")->status_is(200);
my @committees;
$t->tx->result->dom->find('.committeename a')->each(sub { push @committees, $_->{href} });
$t->get_ok($_)  for @committees;

# ...and a bill
$t->get_ok("/bills/HB2")
    ->status_is(200);


done_testing();
