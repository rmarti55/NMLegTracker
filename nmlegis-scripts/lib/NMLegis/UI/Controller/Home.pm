package NMLegis::UI::Controller::Home;
use Mojo::Base 'Mojolicious::Controller', -signatures;

use Date::Parse;
use Time::Piece;

sub index ($self) {
  $self->render();
}

sub about ($self) {
    my @changelog;
    if (open my $fh, '<', 'Changelog') {
        while (my $line = <$fh>) {
            chomp $line;
            next unless $line;
            if ($line =~ /^\*\s+(\d+-\d+-\d+)/) {
                my $t = str2time($1);
                my $lt = localtime($t);

                my $friendly_date = $lt->strftime("%b %e");
                if (time - $t > 4 * 40 * 86400) {
                    $friendly_date .= $lt->strftime(", %Y");
                }
                push @changelog, [ $friendly_date, [] ];
            }
            elsif ($line =~ /^\s+-\s*(.*)/) {
                push @{$changelog[-1][1]}, $1;
            }
            else {
                warn "Changelog: cannot grok '$line'";
            }
        }
        close $fh;
    }

    $self->render(changelog => \@changelog);
}

1;
