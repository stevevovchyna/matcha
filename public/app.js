const deleteTag = (user_id, tag_id) => {
	var stringUserID = user_id.toString();
	var stringTagID = tag_id.toString();
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", "http://localhost:3000/profile/"+stringUserID+"/"+stringTagID+"/tagdel?_method=DELETE", true);
	xmlhttp.onreadystatechange = function () {
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
			var resp = JSON.parse(xmlhttp.responseText);
			if (resp.status === 'success') {
				var taggi = document.getElementById(stringTagID);
				taggi.remove();
				$('div.modal-body > p').text("Tag deleted!");
				$('#myModal').modal('show');
			} else {
				$('div.modal-body > p').text("Something went wrong!");
				$('#myModal').modal('show');
				console.log(resp.error);
			}
		}
	}
	xmlhttp.send(stringUserID);
}

function filterBy(min, max, param) {
	var f_min = parseInt(min);
	var f_max = parseInt(max);
	if ((f_min < 0) || (f_max > 20000) || (f_min > f_max)) {
		$('div.modal-body > p').text('Incorrect filter parameters');
		$('#myModal').modal('show');
		return;
	}
	var lol = document.getElementsByClassName(param);
	for (var i = 0; i < lol.length; i++) {
		if (lol[i].parentElement.parentElement.parentElement.style.display = 'none') {
			lol[i].parentElement.parentElement.parentElement.style.display = 'block';
		}
		if ((parseInt(lol[i].innerText) < f_min) || (parseInt(lol[i].innerText) > f_max)) {
			lol[i].parentElement.parentElement.parentElement.style.display = "none";
		}
	}
	console.log('OTSORTOVAL!!!!!')
}

function getVals() {
	// Get slider values
	var parent = this.parentNode;
	var slides = parent.getElementsByTagName("input");
	var slide1 = parseFloat(slides[0].value);
	var slide2 = parseFloat(slides[1].value);
	// Neither slider will clip the other, so make sure we determine which is larger
	if (slide1 > slide2) {
		var tmp = slide2;
		slide2 = slide1;
		slide1 = tmp;
	}

	var displayElement = parent.getElementsByClassName("rangeValues")[0];
	displayElement.innerHTML = slide1 + " - " + slide2;
}

window.onload = function () {
	// Initialize Sliders
	var sliderSections = document.getElementsByClassName("range-slider");
	for (var x = 0; x < sliderSections.length; x++) {
		var sliders = sliderSections[x].getElementsByTagName("input");
		for (var y = 0; y < sliders.length; y++) {
			if (sliders[y].type === "range") {
				sliders[y].oninput = getVals;
				// Manually trigger event first time to display values
				sliders[y].oninput();
			}
		}
	}
}

function likeUser(id, profile = "no") {
	userid = id.toString();
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", "http://localhost:3000/likes/" + userid + "/ajaxlike?_method=PUT", true);
	xmlhttp.onreadystatechange = function () {
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
			var resp = JSON.parse(xmlhttp.responseText);
			if (resp.status === 'success') {
				var card = document.getElementById(userid);
				if (profile === "yes") {
					$('#possibility').text("This person already knows about your sympathy");
				}
				card.querySelector('#fame-badge-' + userid).innerText = resp.user.likes.length + resp.user.visits.length;
				card.querySelector('#like-badge-' + userid).innerText = resp.user.likes.length;
				$('div.modal-body > p').text(resp.message);
				$('#myModal').modal('show');
			} else {
				$('div.modal-body > p').text(resp.error);
				$('#myModal').modal('show');
				console.log(resp.error)
			}
		}
	}
	xmlhttp.send(id);
}

function dislikeUser(id, profile = "no") {
	userid = id.toString();
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", "http://localhost:3000/likes/" + userid + "/ajaxdislike?_method=DELETE", true);
	xmlhttp.onreadystatechange = function () {
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
			var resp = JSON.parse(xmlhttp.responseText);
			if (resp.status === 'success') {
				var card = document.getElementById(userid);
				if (profile === "yes") {
					$('#possibility').text("You can like this profile!!!");
				}
				card.querySelector('#fame-badge-' + userid).innerText = resp.user.likes.length + resp.user.visits.length;
				card.querySelector('#like-badge-' + userid).innerText = resp.user.likes.length;
				$('div.modal-body > p').text("You don't like this person's profile anymore");
				$('#myModal').modal('show');
			} else {
				$('div.modal-body > p').text(resp.error);
				$('#myModal').modal('show');
			}
		}
	}
	xmlhttp.send(id);
}

const fake = (id) => {
	userid = id.toString();
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", "http://localhost:3000/fakenblock/" + userid + "/ajaxfakeaccount?_method=PUT", true);
	xmlhttp.onreadystatechange = function () {
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
			var resp = JSON.parse(xmlhttp.responseText);
			if (resp.status === 'success') {
				var card = document.getElementById(userid);
				$('div.modal-body > p').text("Thank you for the report - we will check this profile as soon as we can!");
				$('#myModal').modal('show');
			} else {
				$('div.modal-body > p').text(resp.error);
				$('#myModal').modal('show');
			}
		}
	}
	xmlhttp.send(id);
}

const block = (id) => {
	userid = id.toString();
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("POST", "http://localhost:3000/fakenblock/" + userid + "/ajaxblockaccount?_method=PUT", true);
	xmlhttp.onreadystatechange = function () {
		if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
			var resp = JSON.parse(xmlhttp.responseText);
			if (resp.status === 'success') {
				var card = document.getElementById(userid);
				$('#block-button').text(resp.buttonText);
				$('#disability').text(resp.message);
				$('div.modal-body > p').text(resp.message);
				$('#myModal').modal('show');
			} else {
				$('div.modal-body > p').text(resp.error);
				$('#myModal').modal('show');
			}
		}
	}
	xmlhttp.send(id);
}
