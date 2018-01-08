// ==UserScript==
// @name         SC History
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Shows EW Statistics and adds some other functionality
// @author       Krzysztof Kruk
// @match        https://*.eyewire.org/*
// @exclude      https://*.eyewire.org/1.0/*
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/EyeWire-SC-History/master/sc_history.user.js
// ==/UserScript==

/*jshint esversion: 6 */
/*globals $, account, tomni, Cell */


const LOCAL = false;
if (LOCAL) {
  console.log('%c--== TURN OFF "LOCAL" BEFORE RELEASING!!! ==--', "color: red; font-style: italic; font-weight: bold;");
}


(function() {
  'use strict';
  'esversion: 6';

  var K = {
    gid: function (id) {
      return document.getElementById(id);
    },
    
    qS: function (sel) {
      return document.querySelector(sel);
    },
    
    qSa: function (sel) {
      return document.querySelectorAll(sel);
    },


    addCSSFile: function (path) {
      $("head").append('<link href="' + path + '" rel="stylesheet" type="text/css">');
    },


    // Source: https://stackoverflow.com/a/6805461
    injectJS: function (text, sURL) {
      var
        tgt,
        scriptNode = document.createElement('script');

      scriptNode.type = "text/javascript";
      if (text) {
        scriptNode.textContent = text;
      }
      if (sURL) {
        scriptNode.src = sURL;
      }

      tgt = document.getElementsByTagName('head')[0] || document.body || document.documentElement;
      tgt.appendChild(scriptNode);
    },
    
    // localStorage
    ls: {
      get: function (key) {
        return localStorage.getItem(account.account.uid + '-ews-' + key);
      },

      set: function (key, val) {
        localStorage.setItem(account.account.uid + '-ews-' + key, val);
      },

      remove: function (key) {
        localStorage.removeItem(account.account.uid + '-ews-' + key);
      }
    }
  };


  var intv = setInterval(function () {
    if (typeof account === 'undefined' || !account.account.uid) {
      return;
    }
    clearInterval(intv);
    main();
  }, 100);
  
  function main() {


function SCHistory() {
  var
    _this = this;

  $('body').append('<div id="ewsSCHistory"><div id="ewsSCHistoryWrapper"></div></div>');

  $('#ewsSCHistory').dialog({
    autoOpen: false,
    hide: true,
    modal: true,
    show: true,
    dialogClass: 'ews-dialog',
    title: 'Cubes completed in cells SCed during last 30 days',
    width: 880,
    open: function (event, ui) {
      $('.ui-widget-overlay').click(function() { // close by clicking outside the window
        $('#ewsSCHistory').dialog('close');
      });
    }
  });

  this.updateCount = function (count, cellId, cellName, timestamp, datasetId) {
    var
      lsHistory = K.ls.get('sc-history');

    if (lsHistory && lsHistory !== '{}') {
      lsHistory = JSON.parse(lsHistory);
    }
    else {
      lsHistory = {};
    }

    lsHistory[cellId] = {count: count, ts: timestamp, name: cellName, datasetId: datasetId};

    K.ls.set('sc-history', JSON.stringify(lsHistory));
  };

  this.removeOldEntries = function () {
    var
      cellId,
      now = Date.now(),
      thirtyDays = 1000 * 60 * 60 * 24 * 30,
      lsHistory = K.ls.get('sc-history');

    if (lsHistory && lsHistory !== '{}') {
      lsHistory = JSON.parse(lsHistory);
      for (cellId in lsHistory) {
        if (lsHistory.hasOwnProperty(cellId)) {
          if (now - lsHistory[cellId].ts > thirtyDays) {
            delete lsHistory[cellId];
          }
        }
      }
      K.ls.set('sc-history', JSON.stringify(lsHistory));
    }
  };
  
  this.removeEntry = function (cellId) {
    var
      lsHistory = K.ls.get('sc-history');
    
    if (lsHistory && lsHistory !== '{}') {
      lsHistory = JSON.parse(lsHistory);
      delete lsHistory[cellId];
      K.ls.set('sc-history', JSON.stringify(lsHistory));
    }
  };

  this.updateDialogWindow = function () {
    let
      cellId,
      html = '',
      el, threshold,
      lsHistory = K.ls.get('sc-history'),
      status,
      completed3Color = Cell.ScytheVisionColors.complete3;

    if (lsHistory && lsHistory !== '{}') {
      lsHistory = JSON.parse(lsHistory);

      html += `
      <hr>
        <div>
          <div id="scHistorySearchForCompleted" class="minimalButton selected sc-history-top-menu">Search for completed cells</div>
          <div id="scHistoryRemoveCompleted" class="minimalButton selected sc-history-top-menu">Remove completed cells</div>
          <div id="sc-history-top-menu-input-wrapper">Remove cells with SC# less than <input id="scHistoryRemoveBelowTresholdInput" type="number"><div id="scHistoryRemoveBelowTresholdButton" class="minimalButton selected sc-history-top-menu">Go</div></div>
        </div>
        <hr>
        <br>
      `;

      html += `
        <div class="ewsNavButtonGroup" id="ews-sc-history-period-selection">
          <div class="ewsNavButton" data-time-range="day">last 24h</div>
          <div class="ewsNavButton" data-time-range="week">last 7 days</div>
          <div class="ewsNavButton selected" data-time-range="month">last 30 days</div>
        </div>
        <div class="ewsNavButtonGroup" id="ews-sc-history-dataset-selection">
          <div class="ewsNavButton" data-type="1">Mouse's Retina</div>
          <div class="ewsNavButton" data-type="11">Zebrafish's Hindbrain</div>
          <div class="ewsNavButton selected" data-type="both">Both</div>
        </div>
      `;

      html += `<table id="ews-sc-history-results">
        <thead><tr>
          <th># of SCs</th>
          <th>Cell Name</th>
          <th>Cell ID</th>
          <th>Timestamp</th>
          <th>sc-info</th>
          <th>Cubes you can SC</th>
          <th>Status</th>
          <th>&nbsp;</th>
        </tr></thead>`;

      html += '<tbody>';

      for (cellId in lsHistory) {
        if (lsHistory.hasOwnProperty(cellId)) {
          el = lsHistory[cellId];
          if (el.count > 100) {
            threshold = ' class="SCHistory-100"';
          }
          else if (el.count > 50) {
            threshold = ' class="SCHistory-50"';
          }
          else {
            threshold = '';
          }
          
          status = el.status || '--';

          html += `<tr
          data-count="` + el.count + `"
          data-cell-id="` + cellId + `"
          data-timestamp="` + el.ts + `"
          data-dataset-id="` + el.datasetId + `"
          data-status="` + status + `"
          >
            <td` + threshold + `>` + el.count + `</td>
            <td class="sc-history-cell-name">` + el.name + `</td>
            <td class="sc-history-cell-id">` + cellId + `</td>
            <td>` + (new Date(el.ts)).toLocaleString() + `</td>
            <td><button class="sc-history-check-button minimalButton">Check</button></td>
            <td class="sc-history-results"></td>
            <td>` + (status === 'Completed' ? '<span style="color: ' + completed3Color + ';">Completed</span>' : status) + `</td>
            <td><button class="sc-history-remove-button minimalButton">Remove</button></td>
          </tr>`;
        }
      }
      html += '</tbody></table>';
    }
    else {
      html = 'no cubes SCed for last 7 days or since installing the script';
    }

    K.gid('ewsSCHistoryWrapper').innerHTML = html;
    
    $('#scHistoryRemoveBelowTresholdInput').on('keypress keydown keyup', function (evt) {
      evt.stopPropagation();
    });
  };

  
  this.filter = function (period, type) {
    var
      range,
      day = 1000 * 60 * 60 * 24,
      now = Date.now(),
      rows = document.querySelectorAll('#ews-sc-history-results tbody tr');

      switch (period) {
        case 'day': range = now - day; break;
        case 'week': range = now - 7 * day; break;
        case 'month': range = now - 30 * day; break;
      }
      
      
      for (let row of rows) {
        if (row.dataset.timestamp >= range && (type === 'both' || row.dataset.datasetId == type)) {
          row.style.display = 'table-row';
        }
        else {
          row.style.display = 'none';
        }
      }
  };
  
  $('body').append(`
    <div id="sc-history-popup" tabindex="-1">
      <span id="sc-history-remove-older">Remove all cells older than this one</span><br>
      <span id="sc-history-remove-fewer">Remove all cells with SC # lower than this one</span>
    </div>
  `);
  
  
  let removeHelper = function (lParam, rParam) {
    let type = $('#ews-sc-history-dataset-selection .selected').data('type');
    let baseCellData = K.gid('ewsSCHistoryWrapper').dataset;
    let data = K.ls.get('sc-history');
    if (!data || data === '{}') {
      return;
    }

    data = JSON.parse(data);
    for (let cellId in data) {
      if (data.hasOwnProperty(cellId)) {
        if (data[cellId][lParam] < baseCellData[rParam] && (data[cellId].datasetId == type || type === 'both')) {
          delete data[cellId];
        }
      }
    }

    K.ls.set('sc-history', JSON.stringify(data));
    _this.updateDialogWindow();
    // to switch back to the tab selected before updating the dialog window
    $('#ews-sc-history-dataset-selection').find('.ewsNavButton').each(function () {
      if (this.dataset.type == type) {
        this.click();
        return false;
      }
    });
  };

  let doc = $(document);
  
  doc.on('contextmenu', '#profileButton', function (e) {
    e.preventDefault();
    e.stopPropagation();
    _this.updateDialogWindow();
    $('#ewsSCHistory').dialog('open');
    K.gid('ewsSCHistory').style.maxHeight = window.innerHeight - 100 + 'px';
  });
  
  doc.on('votes-updated', function (event, data) {
    var
      _data = data,
      host = window.location.hostname,
      targetUrl = 'https://';

    if (host.indexOf('beta') !== -1) {
      targetUrl += 'beta.';
    }
    else if (host.indexOf('chris') !== -1) {
      targetUrl += 'chris.';
    }
    targetUrl += 'eyewire.org/1.0/cell/' + data.cellId + '/tasks/complete/player';

    $.getJSON(targetUrl, function (JSONData) {
      var
        uid = account.account.uid;

      if (!JSONData) {
        return;
      }

      _this.updateCount(JSONData.scythe[uid].length, _data.cellId, _data.cellName, Date.now(), _data.datasetId);
    });
  });
  
  doc.on('contextmenu', '.sc-history-remove-button', function (evt) {
    $('#sc-history-popup').css({
      left: evt.clientX,
      top: evt.clientY,
      display: 'block'
    });

    // copy data- attrs from the selected row to the top-most container to know
    // what rules use to remove entries
    // source: https://stackoverflow.com/a/20074111
    Object.assign(
      K.gid('ewsSCHistoryWrapper').dataset,
      this.parentNode.parentNode.dataset
    );

    evt.preventDefault();
  });
  
  doc.on('click', function (evt) {
    if (evt.target.id !== 'sc-history-popup') {
      K.gid('sc-history-popup').style.display = 'none';
    }
  });
  
  doc.on('keydown', function (evt) {
    if (evt.keyCode === 27) {
      K.gid('sc-history-popup').style.display = 'none';
    }
  });

  doc.on('click', '#sc-history-remove-older', removeHelper.bind(null, 'ts', 'timestamp'));
  doc.on('click', '#sc-history-remove-fewer', removeHelper.bind(null, 'count', 'count'));


  let wrapper = $('#ewsSCHistoryWrapper');
  
  wrapper.on('click', '.sc-history-cell-name', function () {
    tomni.setCell({id: this.nextElementSibling .innerHTML});
  });
  
  wrapper.on('click', '.sc-history-check-button', function () {
    var
      _this = this,
      cellId = this.parentNode.parentNode.dataset.cellId;

    $.when(
      $.getJSON("/1.0/cell/" + cellId + "/tasks"),
      $.getJSON("/1.0/cell/" + cellId + "/heatmap/scythe"),
      $.getJSON("/1.0/cell/" + cellId + "/tasks/complete/player")
    )
    .done(function (tasks, scythe, completed) {
      let potential, complete, uid, completedByMe;

      tasks = tasks[0];
      complete = scythe[0].complete || [];
      completed = completed[0];

      /* status =
        active: 0
        frozen: 10
        duplicate: 11
        stashed: 6 */
      
      potential = tasks.tasks.filter(x => (x.status === 0 || x.status === 11) && x.weight >= 3);

      potential = potential.map(x => x.id);

      complete = complete.filter(x => x.votes >= 2 && !account.account.admin);
      complete = complete.map(x => x.id);
      potential = potential.filter(x => complete.indexOf(x) === -1);

      uid = account.account.uid;
      completedByMe = completed.scythe[uid].concat(completed.admin[uid]);
      potential = potential.filter(x => completedByMe.indexOf(x) === -1);

      _this.parentNode.nextElementSibling.innerHTML = potential.length;
    });
  });
  
  wrapper.on('click', '.sc-history-remove-button', function () {
    var id;

    id = this.parentNode.parentNode.getElementsByClassName('sc-history-cell-id')[0].innerHTML;
    _this.removeEntry(id);
    this.parentNode.parentNode.remove();
  });
  
  wrapper.on('click', '#ews-sc-history-period-selection .ewsNavButton, #ews-sc-history-dataset-selection .ewsNavButton', function () {
    var
      period, type;

    $(this)
      .parent()
        .find('.ewsNavButton')
          .removeClass('selected')
        .end()
      .end()
      .addClass('selected');
      
    period = $('#ews-sc-history-period-selection .selected').data('timeRange');
    type = $('#ews-sc-history-dataset-selection .selected').data('type');

    _this.filter(period, type);
  });
  
  wrapper.on('click', '#scHistorySearchForCompleted', function () {
    let type = $('#ews-sc-history-dataset-selection .selected').data('type');
    let cells = K.ls.get('sc-history');
    let cell;
    
    if (! cells || cells === '{}') {
      return;
    }
    
    cells = JSON.parse(cells);
    for (let cellId in cells) {
      if (cells.hasOwnProperty(cellId)) {
        cell = cells[cellId];
        if ((!cell.status || cell.status !== 'Completed') && (cell.datasetId == type || type === 'both')) {
          $.getJSON('https://eyewire.org/1.0/cell/' + cellId, function (data) {
            if (data && data.completed !== null) {
              cell.status = 'Completed';
              // read and write to localStorage in each iteration, because otherwise
              // only the last would be saved
              let tempList = JSON.parse(K.ls.get('sc-history'));
              tempList[cellId].status = 'Completed';
              K.ls.set('sc-history', JSON.stringify(tempList));
              _this.updateDialogWindow();
              $('#ews-sc-history-dataset-selection').find('.ewsNavButton').each(function () {
                if (this.dataset.type == type) {
                  this.click();
                  return false;
                }
              });
            }
          });
        }
      }
    }
  });
  
  wrapper.on('click', '#scHistoryRemoveCompleted', function () {
    let type = $('#ews-sc-history-dataset-selection .selected').data('type');
    let cells = K.ls.get('sc-history');
    let cell;
    
    if (!cells || cells === '{}') {
      return;
    }
    
    cells = JSON.parse(cells);
    
    for (let cellId in cells) {
      if (cells.hasOwnProperty(cellId)) {
        cell = cells[cellId];
        if ((cell.status && cell.status === 'Completed') && (cell.datasetId == type || type === 'both')) {
          delete cells[cellId];
        }
      }
    }
    
    K.ls.set('sc-history', JSON.stringify(cells));
    _this.updateDialogWindow();
    $('#ews-sc-history-dataset-selection').find('.ewsNavButton').each(function () {
      if (this.dataset.type == type) {
        this.click();
        return false;
      }
    });
  });
  
  wrapper.on('click', '#scHistoryRemoveBelowTresholdButton', function () {
    let type = $('#ews-sc-history-dataset-selection .selected').data('type');
    let val = K.gid('scHistoryRemoveBelowTresholdInput').value;
    let cell;
    
    if (val && val > 0) {
      let cells = K.ls.get('sc-history');
      
      if (!cells || cells === '{}') {
        return;
      }
      
      cells = JSON.parse(cells);
      
      for (let cellId in cells) {
        if (cells.hasOwnProperty(cellId)) {
          cell = cells[cellId];
          if ((cell.count < val) && (cell.datasetId == type || type === 'both')) {
            delete cells[cellId];
          }
        }
      }
      
      K.ls.set('sc-history', JSON.stringify(cells));
      _this.updateDialogWindow();
      $('#ews-sc-history-dataset-selection').find('.ewsNavButton').each(function () {
        if (this.dataset.type == type) {
          this.click();
          return false;
        }
      });
    }
  });
}


if (LOCAL) {
  K.addCSSFile('http://127.0.0.1:8887/styles.css');
}
else {
  K.addCSSFile('https://chrisraven.github.io/EyeWire-SC-History/styles.css');
}


K.injectJS(`
  (function (open) {
    XMLHttpRequest.prototype.open = function (method, url, async, user, pass) {
      this.addEventListener("readystatechange", function (evt) {
        if (this.readyState == 4 && this.status == 200 &&
            url.indexOf('/1.0/task/') !== -1 &&
            url.indexOf('/submit') === -1 &&
            method.toLowerCase() === 'post') {
          $(document).trigger('votes-updated', {cellId: tomni.cell, cellName: tomni.getCurrentCell().info.name, datasetId: tomni.getCurrentCell().info.dataset_id});
        }
      }, false);
      open.call(this, method, url, async, user, pass);
    };
  }) (XMLHttpRequest.prototype.open);
`);


// source: https://stackoverflow.com/a/14488776
// to allow html code in the title option of a dialog window
$.widget('ui.dialog', $.extend({}, $.ui.dialog.prototype, {
  _title: function(title) {
    if (!this.options.title) {
      title.html('&#160;');
    }
    else {
      title.html(this.options.title);
    }
  }
}));


if (account.roles.scythe || account.roles.mystic || account.roles.admin) {
  var history = new SCHistory();
  history.removeOldEntries();
}


} // end: main()


})(); // end: wrapper
