package NMLegis::UI;
use Mojo::Base 'Mojolicious', -signatures;

use File::Slurp;
use JSON::XS;

use NMLegis                             qw($Data_Dir);
use NMLegis::UI::Model::DB;
use NMLegis::UI::Model::User;

# This method will run once at server start
sub startup ($self) {

  $self->log->level('warn');

  # Actual site
  if (-e 'callme') {
      $self->plugin(MailException => {
          from    => 'mojo@nmlegiswatch.org',
          to      => 'ed',
          subject => 'nmlegis mojo crash',
      });

      $self->log( Mojo::Log->new( path => "logs/nmlegis.log",
                                  level => 'info') );

      # I want to see all warnings
      $SIG{__WARN__} = sub { $self->log->warn(@_) };
  }

  # Load configuration from config file
  my $config = $self->plugin('NotYAMLConfig');

#  use Data::Dump; dd $config;
  # Configure the application
  $self->secrets($config->{secrets});

  # This is a low stakes web site; long-lived cookies are OK
  $self->sessions->default_expiration(86400 * 365.25 * 2);      # 2 years

  $self->helper(user => sub ($self) { _user($self) });
  $self->helper(db   => sub ($self) { NMLegis::UI::Model::DB->new });

  # Router
  my $r = $self->routes;

  # Normal route to controller
  # FIXME rename this
  $r->get('/')->to('Home#index');
  $r->get('/about')->to('Home#about');

  $r->get('/login/reset/:token')->to('Auth#reset');
  $r->get('/login/reset')->to('Auth#reset_form');
  $r->post('/login/reset')->to('Auth#reset');

  $r->get('/login')->to('Auth#login_form');
  $r->post('/login')->to('Auth#login');
  $r->get('/logout')->to('Auth#logout');

  $r->get('/register')->to('Auth#register_form');
  $r->post('/register')->to('Auth#register');

  $r->get('/bills')->to('Bills#index');
  $r->get('/bills/history')->to('Bills#filinghistory');
  $r->get('/bills/halfpassed')->to('Bills#halfpassed');
  $r->get('/bills/pending')->to('Bills#pending');
  $r->get('/bills/signed')->to('Bills#signed');
  $r->get('/bills/vetoed')->to('Bills#vetoed');
  $r->get('/bills/#bill')->to('Bills#bill');
  $r->put('/bills/userreport')->to('Bills#user_report');

  $r->get('/committees')->to('Committees#index');
  $r->get('/committees/schedules')->to('Committees#schedules');
  $r->get('/committees/#committee')->to('Committees#committee');
  $r->get('/House')->to('Committees#committee', committee => 'House');
  $r->get('/Senate')->to('Committees#committee', committee => 'Senate');

  $r->get('/legislators')->to('Legislators#index');
  $r->get('/legislators/#legislator')->to('Legislators#legislator');

  $r->get('/aauw')->to('Trackers#aauw');        # FIXME
  $r->get('/trackers')->to('Trackers#index');
  $r->post('/trackers/subscribe')->to('Trackers#manage_subscription');
  $r->post('/trackers/unsubscribe')->to('Trackers#manage_subscription');
  $r->post('/trackers/onebill')->to('Trackers#manage_tracking');
  $r->get('/trackers/edit/:tracker')->to('Trackers#edit');
  $r->post('/trackers/edit')->to('Trackers#process_edit');
  $r->get('/trackers/:tracker')->to('Trackers#tracker');
  $r->put('/trackers/update')->to('Trackers#update');

  $r->get('/settings')->to('Settings#index');
  $r->post('/settings')->to('Settings#update');

  $r->get('/search')->to('Search#search');
}

# FIXME: remove this once migration to ::Model is done
sub read_json($self, $file) {
    my $json = read_file("$Data_Dir/$file");
    return decode_json($json);
};


sub _user ($c) {
    return NMLegis::UI::Model::User->new($c);
}


1;
