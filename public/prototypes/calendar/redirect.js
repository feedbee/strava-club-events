const destination = location.pathname.endsWith('experiment-login.html') ? 'login.html' : 'index.html';
location.replace('/prototypes/calendar/' + destination + location.search + location.hash);
