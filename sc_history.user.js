// ==UserScript==
// @name         SC History
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Shows EW Statistics and adds some other functionality
// @author       Krzysztof Kruk
// @match        https://*.eyewire.org/*
// @exclude      https://*.eyewire.org/1.0/*
// @downloadURL  https://raw.githubusercontent.com/ChrisRaven/EyeWire-SC-History/master/sc_history.user.js
// ==/UserScript==

/*jshint esversion: 6 */
/*globals $, account */


(function() {
  'use strict';
  'esversion: 6';

  let K = {
    gid: id => document.getElementById(id),
    cl: cls => document.getElementsByClassName(cls)[0],
    qS: sel => document.querySelector(sel),
    qSa: sel => document.querySelectorAll(sel),

    // localStorage
    ls: {
      get: key => localStorage.getItem(account.account.uid + '-ews-' + key),
      set: (key, val) => localStorage.setItem(account.account.uid + '-ews-' + key, val),
      remove: key => localStorage.removeItem(account.account.uid + '-ews-' + key)
    }
  };

  let schistory;
  let settings;

  let intv = setInterval(function () {
    if (typeof account === 'undefined' || !account.account.uid) {
      return;
    }
    clearInterval(intv);
        
    if (account.can('scythe mystic admin')) {
      schistory = new SCHistory();

      settings = new Settings();

      let checked = K.ls.get('settings-color-sced-cells') === 'true';
      settings.addCategory();
      settings.addOption({
        name: 'Color SCed cells',
        id: 'settings-color-sced-cells',
        state: checked,
        defaultState: true
      });
    }

  }, 100);

  function Settings() {
    let target;
    
    this.setTarget = function (selector) {
      target = selector;
    };
    
    this.getTarget = function () {
      return target;
    };
    
    this.addCategory = function (id = 'ews-sc-history-settings-group', name = 'SC History') {
      if (!K.gid(id)) {
        $('#settingsMenu').append(`
          <div id="${id}" class="settings-group ews-settings-group invisible">
            <h1>${name}</h1>
          </div>
        `);
      }
      
      this.setTarget($('#' + id));
    };

    this.addOption = function (options) {
      let settings = {
        name: '',
        id: '',
        defaultState: false,
        indented: false
      }

      $.extend(settings, options);
      let storedState = K.ls.get(settings.id);
      let state;

      if (storedState === null) {
        K.ls.set(settings.id, settings.defaultState);
        state = settings.defaultState;
      }
      else {
        state = storedState.toLowerCase() === 'true';
      }

      target.append(`
        <div class="setting" id="${settings.id}-wrapper">
          <span>${settings.name}</span>
          <div class="checkbox ${state ? 'on' : 'off'}">
            <div class="checkbox-handle"></div>
            <input type="checkbox" id="${settings.id}" style="display: none;" ${state ? ' checked' : ''}>
          </div>
        </div>
      `);
      
      if (settings.indented) {
        K.gid(settings.id).parentNode.parentNode.style.marginLeft = '30px';
      }
      
      $(`#${settings.id}-wrapper`).click(function (evt) {
        evt.stopPropagation();

        let $elem = $(this).find('input');
        let elem = $elem[0];
        let newState = !elem.checked;

        K.ls.set(settings.id, newState);
        elem.checked = newState;

        $elem.add($elem.closest('.checkbox')).removeClass(newState ? 'off' : 'on').addClass(newState ? 'on' : 'off');
        $(document).trigger('ews-setting-changed', {setting: settings.id, state: newState});
      });
      
      $(document).trigger('ews-setting-changed', {setting: settings.id, state: state});
    };
    
    this.getValue = function (optionId) {
      let val = K.ls.get(optionId);
      
      if (val === null) {
        return undefined;
      }
      if (val.toLowerCase() === 'true') {
        return true;
      }
      if (val.toLowerCase() === 'false') {
        return false;
      }

      return val;
    }
  }


  function SCHistory() {
    // cleaning from the previous version
    K.ls.remove('sc-history-update-2018-01-30');
    K.ls.remove('sc-history');
    

    this.updateCell = function (cellName, cellId) {
      $.when(
        $.getJSON('/1.0/cell/' + cellId + '/tasks'),
        $.getJSON('/1.0/cell/' + cellId + '/heatmap/scythe'),
        $.getJSON('/1.0/cell/' + cellId + '/tasks/complete/player')
      )
      .done(function (tasks, scythe, completed) {
        let potential, complete, uid, completedByMe;

        tasks = tasks[0];
        complete = scythe[0].complete || [];
        completed = completed[0] || [];

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
        if (completed.scythe[uid]) {
          completedByMe = completed.scythe[uid].concat(completed.admin[uid]);
        }
        else {
          completedByMe = completed.admin[uid] || [];
        }
        potential = potential.filter(x => completedByMe.indexOf(x) === -1);


        let name = $('.cells .name:contains(' + cellName + ')');
        if (!name.length) { // if used closed the cell list earlier
          return;
        }

        if (settings.getValue('settings-color-sced-cells')) {
          let vanillaName = name[0];
          let color;
          let myCompletes = completedByMe.length;

          if (myCompletes >= 50) {
            color = vanillaName.parentNode.classList.contains('current') ? '#929a0f' : 'yellow';
          }
          
          if (myCompletes >= 100) {
            color = vanillaName.parentNode.classList.contains('current') ? '#0fb30f' : '#00ff00';
          }

          vanillaName.style.color = color;
        }

        name.parent().append('<td>' + completedByMe.length + '</td><td>' + potential.length + '</td>');
      });
    };
    

    this.updateCellList = function () {
      let _this = this;
      let sectionsNames = ['Events', 'Fort Scythe', 'Playable', 'Scouts &amp; Scythes Needed'];
      $.when(
        $.getJSON('https://eyewire.org/1.0/cell/?dataset=1')
      )
      .done(data => {
        let headers = K.qSa('.cells table tr th:first-child');
        headers.forEach(header => {
          let sectionName = header.parentElement.parentElement.parentElement.previousSibling.innerHTML;
          if (sectionsNames.indexOf(sectionName) !== -1) {
            $(header).parent().append('<th class="schistory-SCed">SCed</th><th class="schistory-toSC">to SC</th>');
          }
        });

        data.forEach(cell => {
          if (!cell.completed) {
            _this.updateCell(cell.name, cell.id);
          }
        });
      });
    };

    
    K.gid('changeCell').addEventListener('click', function () {
      let tries = 300;
      let intv = setInterval(function () {
        if (!(tries--)) { // if after 300 * 50ms = 15s there's no cells' list, stop checking for it
          clearInterval(intv);
          return;
        }

        if (!K.qS('.cell-picker')) {
          return;
        }

        let observer = new MutationObserver(mutations => {
          if (!K.cl('cell-picker')) { // change cell popup closed
            observer.disconnect();
          }

          // we don't need to loop over all mutations in a given change,
          // especially, that .cells is chagned multiple times each time the list is loaded
          // so the SC nubmers would refresh a couple of times each time
          let mutation = mutations[0];

          if (mutation.target.classList.contains('cells')) {
            if (K.qS('.dataset.selected div').innerHTML === 'Eyewire') {
              schistory.updateCellList();
            }
          }
        });

        observer.observe(K.cl('cell-picker'), {
          childList: true,
          subtree: true,
          attributes: true
        });

        schistory.updateCellList();


        clearInterval(intv);
      }, 50);
    });
  }


})(); // end: wrapper
