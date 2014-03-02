var app = {};

app.data = {"airQuality":null};

app.start = function() {
    app.showHome();
}

app.showHome = function() {
    history.pushState({"view":"home"}, null, null);
    $( '#titlebar' ).empty().append( '<h1>Deep Breath</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<button>Enter Location</button>' ).click(function() { app.showSearch(); }));
}

app.showSearch = function() {
    history.pushState({"view":"search"}, null, "search");
    $( '#titlebar' ).empty().append( '<h1>Enter Location</h1>' );
    $( '#content' ).empty();
    $( '#content' ).append($( '<input type="text" id="location"></input>' ));
    $( '#content' ).append($( '<button>Go</button>' ).click(function() { app.parseLocation($( '#location' ).val()); }));
}

app.parseLocation = function(str) {
    // Note: Currently using Google Maps API to find coordinates from given address. Replace with Canadian Open Data when available.
    $.getJSON("http://maps.googleapis.com/maps/api/geocode/json?address=" + str + "&components=country:canada&sensor=false", function(json) {
        if (json.results.length == 1) {
            app.showLocation({"lat": json.results[0].geometry.location.lat, "lng": json.results[0].geometry.location.lng, "address": json.results[0].formatted_address});
        } else {
            app.showSearchResults(json.results);
        }
    });
}

app.showSearchResults = function (obj) {
    history.pushState({"view":"search"}, null, "search");
    $( '#titlebar' ).empty().append( '<h1>Did you mean...</h1>' );
    $( '#content' ).empty();
    var ul = $( '<ul>' ).appendTo( '#content' );
    for (var i in obj) {
        ul.append($( '<li>' + obj[i].formatted_address ).click((function(data) {
            return function() { app.showLocation(data); };
        })({"lat":obj[i].geometry.location.lat, "lng":obj[i].geometry.location.lng, "address":obj[i].formatted_address})));
    }
}

app.showLocation = function (obj) {
    $( '#titlebar' ).empty().append( '<h1>' + obj.address + '</h1>' );
    $( '#content' ).empty();
    // TODO: Find monitoring station within 10km radius, display info;
}

app.getAirQualityData = function (lat, lng) {
    var data = [];
    for (var i in app.data.airQuality) {
        var stn = app.data.airQuality[i];
        if (Math.sqrt(pow((lat - stn.Latitude), 2) + pow((lng - stn.Longitude, 2))) <= 10) {
            data.push(stn);
        }
    }
    return data;
}

window.addEventListener('popstate', function(e) {
    if (event.state.view) {
        switch(event.state.view) {
            case "home":
                app.showHome();
                break;
            case "search":
                app.showSearch();
                break;
        }
    }
});

$(function() {
    $.get('air_quality.csv', function(data) {
        app.data.airQuality = $.csv.toObjects(data, {"separator":"\t"});
        app.start();
    });
});