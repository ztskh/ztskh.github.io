//////////////////////////////
// parseUri 1.2.2
// (c) Steven Levithan <stevenlevithan.com>
// MIT License

function parseUri (str) {
	var	o   = parseUri.options,
		m   = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
		uri = {},
		i   = 14;

	while (i--) uri[o.key[i]] = m[i] || "";

	uri[o.q.name] = {};
	uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
		if ($1) uri[o.q.name][$1] = $2;
	});

	return uri;
};

parseUri.options = {
	strictMode: false,
	key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
	q:   {
		name:   "queryKey",
		parser: /(?:^|&)([^&=]*)=?([^&]*)/g
	},
	parser: {
		strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
		loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
	}
};
//////////////////////////////

var sources = {};
var watchers = {};
var monitoring_interval = null;

function read_config (config) {
	if (config.format == 3) {
		var find_object = function (type, input, classes) {
			var object = null;
			for (var index = 0; index < classes.length && object == null; index++) {
				if (classes[index].code() == type)
					object = classes[index].from_input(input);
			}
			if (object != null) {
				object.check()
					.then(function () {
					object.add();
					});
			}
		};
		var create_objects = function (classes, list) {
			for (var list_index = 0; list_index < list.length; list_index++) {
				var type = list[list_index].type;
				var input = list[list_index].input;
				find_object(type, input, classes);
			}
		};
		create_objects(watcher_classes, config.watchers);
		create_objects(source_classes, config.sources);
		for (var index = 0; index < config.tracks.length; index++) {
			jQuery('<li>')
				.text(config.tracks[index])
				.appendTo('.watcher-content .options .sound .source .list');
		}
		for (var index = 0; index < config.sound.length; index++) {
			jQuery('<source>')
				.attr("type", config.sound[index].type)
				.attr("src", config.sound[index].src)
				.appendTo('.watcher-content .main-controls audio');
		}
	} else {
		var str = "невідомий формат налаштувань"
		alert(str);
	}
}

function remove_startup_message () {
	jQuery('.watcher-content .status .startup-message').fadeOut()
}

function show_startup_failed_message () {
	remove_startup_message();
	jQuery('<div>').text('Не вдалось повноцінно запуститись').addClass('error').addClass('message').appendTo('.watcher-content .status').delay(3000).fadeOut();
}

function start_alarm (source, watcher) {
	console.log('alarm');
	jQuery('.watcher-content .main-controls audio').get(0).play();
}

var FacebookPhotoLikesSource = {
	check : function () {
		return jQuery.getJSON('http://graph.facebook.com/' + this._id)
			.then(function (data) {
				//console.log(data);
			});
	},
	code : function () {
		return 'facebook.photo.likes';
	},
	href : function () {
		return "http://facebook.com/" + this._id;
	},
	label : function () {
		return this.href();
	},
	id : function () {
		return this.code() + "-" + this._id;
	},
	add : function () {
		add_source_object(this);
	},
	inspect_chunk : function (data) {
		for (var like_index = 0; like_index < data.data.length; like_index++) {
			for (var watcher_id in watchers) {
				if (watchers[watcher_id].code() == "facebook.person" && watchers[watcher_id]._id == data.data[like_index].id) {
					start_alarm(this, watchers[watcher_id]);
				}
			}
		}
	},
	inspect : function (after) {
		var _this = this;
		after = after ? '&after=' + after : ''
		return jQuery.getJSON('http://graph.facebook.com/' + this._id + '/likes?limit=500' + after)
			.then(function (data) {
				//console.log(data);
				_this.inspect_chunk(data);
				if (data.paging.next) {
					return _this.inspect(data.paging.cursors.after);
				}
			});
	},
	from_url : function (url) {
		var uri = parseUri(url);
		if (uri.host.match(/facebook.com$/)) {
			if (uri.file == 'photo.php') {
				return FacebookPhotoLikesSource.from_input(uri.queryKey.fbid);
			}
		}
		return null;
	},
	from_input : function (input) {
		var object = {_id : input};
		object.__proto__ = FacebookPhotoLikesSource;
		return object;
	}
};

var FacebookPersonWatcher = {
	check : function () {
		var _this = this;
		return jQuery.getJSON('http://graph.facebook.com/' + this._input)
			.then(function (data) {
				_this._name = data.name;
				_this._id = data.id;
			});
	},
	code : function () {
		return "facebook.person";
	},
	id : function () {
		return this.code() + "-" + this._input;
	},
	href : function () {
		return "http://facebook.com/" + this._input;
	},
	label : function () {
		return this._name ? this._name : this.href();
	},
	add : function () {
		add_watcher_object(this);
	},
	from_url : function (url) {
		var uri = parseUri(url);
		if (uri.host.match(/facebook.com$/)) {
			var match;
			if (uri.directory == '/') {
				return FacebookPersonWatcher.from_input(uri.file);
			} else if (match = uri.path.match(/^\/people\/.+\/(\d+)$/)) {
				return FacebookPersonWatcher.from_input(match[1]);
			}
		}
		return null;
	},
	from_input : function (input) {
		var object = {_input : input};
		object.__proto__ = FacebookPersonWatcher;
		return object;
	}
};

var watcher_classes = [FacebookPersonWatcher];
var source_classes = [FacebookPhotoLikesSource];

function add_source_object (source) {
	jQuery('<li>')
		.attr('id', source.id())
		.append(jQuery('<span>').addClass('code').text(source.code()))
		.append(jQuery('<a>').prop('href', source.href()).text(source.label()))
		.append(jQuery('<span>').addClass('remove').prop('title', 'видалити').text('[X]'))
		.appendTo('.watcher-content .options .sources .list');
	sources[source.id()] = source;
}

function add_watcher_object (watcher) {
	jQuery('<li>')
		.attr('id', watcher.id())
		.append(jQuery('<span>').addClass('code').text(watcher.code()))
		.append(jQuery('<a>').prop('href', watcher.href()).text(watcher.label()))
		.append(jQuery('<span>').addClass('remove').prop('title', 'видалити').text('[X]'))
		.appendTo('.watcher-content .options .watchers .list');
	watchers[watcher.id()] = watcher;
}

function remove_object (button, collection) {
	var row = jQuery(button).closest('li');
	var id = row.attr('id');
	delete(collection[id]);
	row.remove();
}

function add_object (section, classes) {
	var type = section.find('.new-entry .type').val();
	var input = section.find('.new-entry .input').val();
	var object = null;
	if (type == 'auto') {
		for (var index = 0; index < classes.length && object == null; index++) {
			object = classes[index].from_url(input);
		}
	} else {
		for (var index = 0; index < classes.length && object == null; index++) {
			if (classes[index].code() == type)
				object = classes[index].from_input(input);
		}
	}
	if (object != null) {
		section.find('.new-entry .check-status').text("перевірка...").fadeIn();
		object.check()
			.then(function () {
				object.add();
				section.find('.new-entry .check-status').text("").show();
				section.find('.new-entry .block').hide();
			})
			.fail(function () {
				section.find('.new-entry .check-status').text("помилка").show();
			});
	}
}

function get_monitoring_interval () {
	return parseFloat(jQuery('.watcher-content .options .interval').val().replace(",", ".", "g")) * 60 * 1000;
}

function monitoring_function () {
	var now = new Date();
	jQuery('.watcher-content .main-controls .update-status .update-time').text(now.getHours() + ":" + now.getMinutes() + ":" + now.getSeconds());
	var promise = jQuery.when();
	for (var id in sources) {
		promise = promise.then(function(){return sources[id].inspect()});
	}
}

function start_monitoring () {
	if (monitoring_interval != null) {
		clearInterval(monitoring_interval)
		monitoring_interval = null
	}
	jQuery('.watcher-content .main-controls .start').prop("disabled", true);
	jQuery('.watcher-content .main-controls .stop').prop("disabled", false);
	jQuery('.watcher-content .main-controls .update-status').show().find('.update-time').text('...');

	monitoring_interval = setInterval(monitoring_function, get_monitoring_interval());
	monitoring_function();
}

function stop_monitoring () {
	if (monitoring_interval != null) {
		clearInterval(monitoring_interval)
		monitoring_interval = null
	}
	jQuery('.watcher-content .main-controls .start').prop("disabled", false);
	jQuery('.watcher-content .main-controls .stop').prop("disabled", true);
	jQuery('.watcher-content .main-controls .update-status').hide();
}

jQuery(function () {

	var config_url = location.hash.replace(/^#/, '');

	if (config_url == '')
		config_url = 'defaults.json'

	jQuery.getJSON(config_url)
		.then(read_config)
		.then(remove_startup_message)
		.fail(show_startup_failed_message)
		.done();

	[
		{header: ".watcher-content .options-header", section: ".watcher-content .options"},
		{header: ".watcher-content .description-header", section: ".watcher-content .description"},
	].forEach(function (pair) {
		jQuery(pair.header).click(function () {jQuery(pair.section).toggle();});
	});

	jQuery(".watcher-content .folding .header").click(function () {
		jQuery(this).siblings(".block").toggle();
	});

	jQuery(".watcher-content .options .new-entry.folding .header").click(function () {
		jQuery(this).find('.check-status').fadeOut();
	});

	jQuery(".watcher-content .options .sources .add-new").click(function () {
		add_object(jQuery('.watcher-content .options .sources'), source_classes);
	});
	jQuery(".watcher-content .options .watchers .add-new").click(function () {
		add_object(jQuery('.watcher-content .options .watchers'), watcher_classes);
	});

	jQuery(".watcher-content .options .sources .list").on("click", ".remove", function () {
		remove_object(this, sources);
	});
	jQuery(".watcher-content .options .watchers .list").on("click", ".remove", function () {
		remove_object(this, watchers);
	});

	jQuery(".watcher-content .options .sound .by-url .load").click(function () {
		jQuery(".watcher-content .main-controls audio").prop("src", jQuery(".watcher-content .options .sound .by-url .url").val());
	})
	jQuery(".watcher-content .options .sound .listed .list").on("click", "li", function () {
		jQuery(".watcher-content .main-controls audio").prop("src", jQuery(this).text());
	})

	jQuery('.watcher-content .main-controls .start').click(start_monitoring);
	jQuery('.watcher-content .main-controls .stop').click(stop_monitoring);

	jQuery(".watcher-content .options .interval").change(function () {
		var field = jQuery(this);
		var value = parseFloat(field.val().replace(",", ".", "g"));
		if (value > 0) {
			field.val(value.toString().replace(".", ","));
		} else {
			field.val("2,5");
			alert("невірно введений інтервал");
		}
	});

});