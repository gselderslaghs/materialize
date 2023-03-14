import { Component } from "./component";
import $ from "cash-dom";
import { M } from "./global";
import { Autocomplete } from "./autocomplete";

let _defaults = {
  data: [],
  placeholder: '',
  secondaryPlaceholder: '',
  autocompleteOptions: {},
  autocompleteOnly: false,
  limit: Infinity,
  onChipAdd: null,
  onChipSelect: null,
  onChipDelete: null
};

export class Chips extends Component {
  chipsData: any[];
  $chips: any;
  hasAutocomplete: boolean;
  $input: any;
  autocomplete: any;
  private _handleChipClickBound: any;
  private _handleInputKeydownBound: any;
  private _handleInputFocusBound: any;
  private _handleInputBlurBound: any;
  static _keydown: boolean;
  $label: any;
  private _selectedChip: any;

  constructor(el, options) {
    super(Chips, el, options);
    (this.el as any).M_Chips = this;
    this.options = {...Chips.defaults, ...options};

    this.$el.addClass('chips input-field');
    this.chipsData = [];
    this.$chips = $();
    this._setupInput();
    this.hasAutocomplete = Object.keys(this.options.autocompleteOptions).length > 0;
    // Set input id
    if (!this.$input.attr('id')) {
      this.$input.attr('id', M.guid());
    }
    // Render initial chips
    if (this.options.data.length) {
      this.chipsData = this.options.data;
      this._renderChips();
    }
    // Setup autocomplete if needed
    if (this.hasAutocomplete) {
      this._setupAutocomplete();
    }
    this._setPlaceholder();
    this._setupLabel();
    this._setupEventHandlers();
  }

  static get defaults() {
    return _defaults;
  }

  static init(els, options) {
    return super.init(this, els, options);
  }

  static getInstance(el) {
    let domElem = !!el.jquery ? el[0] : el;
    return domElem.M_Chips;
  }

  getData() {
    return this.chipsData;
  }

  destroy() {
    this._removeEventHandlers();
    this.$chips.remove();
    (this.el as any).M_Chips = undefined;
  }

  _setupEventHandlers() {
    this._handleChipClickBound = this._handleChipClick.bind(this);
    this._handleInputKeydownBound = this._handleInputKeydown.bind(this);
    this._handleInputFocusBound = this._handleInputFocus.bind(this);
    this._handleInputBlurBound = this._handleInputBlur.bind(this);

    this.el.addEventListener('click', this._handleChipClickBound);
    document.addEventListener('keydown', Chips._handleChipsKeydown);
    document.addEventListener('keyup', Chips._handleChipsKeyup);
    this.el.addEventListener('blur', Chips._handleChipsBlur, true);
    this.$input[0].addEventListener('focus', this._handleInputFocusBound);
    this.$input[0].addEventListener('blur', this._handleInputBlurBound);
    this.$input[0].addEventListener('keydown', this._handleInputKeydownBound);
  }

  _removeEventHandlers() {
    this.el.removeEventListener('click', this._handleChipClickBound);
    document.removeEventListener('keydown', Chips._handleChipsKeydown);
    document.removeEventListener('keyup', Chips._handleChipsKeyup);
    this.el.removeEventListener('blur', Chips._handleChipsBlur, true);
    this.$input[0].removeEventListener('focus', this._handleInputFocusBound);
    this.$input[0].removeEventListener('blur', this._handleInputBlurBound);
    this.$input[0].removeEventListener('keydown', this._handleInputKeydownBound);
  }

  _handleChipClick(e) {
    let $chip = $(e.target).closest('.chip');
    let clickedClose = $(e.target).is('.close');
    if ($chip.length) {
      let index = $chip.index();
      if (clickedClose) {
        // delete chip
        this.deleteChip(index);
        this.$input[0].focus();
      } else {
        // select chip
        this.selectChip(index);
      }
      // Default handle click to focus on input
    } else {
      this.$input[0].focus();
    }
  }

  static _handleChipsKeydown(e) {
    Chips._keydown = true;

    let $chips = $(e.target).closest('.chips');
    let chipsKeydown = e.target && $chips.length;

    // Don't handle keydown inputs on input and textarea
    if ($(e.target).is('input, textarea') || !chipsKeydown) {
      return;
    }

    let currChips = ($chips[0] as any).M_Chips;

    // backspace and delete
    if (e.keyCode === 8 || e.keyCode === 46) {
      e.preventDefault();

      let selectIndex = currChips.chipsData.length;
      if (currChips._selectedChip) {
        let index = currChips._selectedChip.index();
        currChips.deleteChip(index);
        currChips._selectedChip = null;

        // Make sure selectIndex doesn't go negative
        selectIndex = Math.max(index - 1, 0);
      }

      if (currChips.chipsData.length) {
        currChips.selectChip(selectIndex);
      } else {
        currChips.$input[0].focus();
      }

      // left arrow key
    } else if (e.keyCode === 37) {
      if (currChips._selectedChip) {
        let selectIndex = currChips._selectedChip.index() - 1;
        if (selectIndex < 0) {
          return;
        }
        currChips.selectChip(selectIndex);
      }

      // right arrow key
    } else if (e.keyCode === 39) {
      if (currChips._selectedChip) {
        let selectIndex = currChips._selectedChip.index() + 1;

        if (selectIndex >= currChips.chipsData.length) {
          currChips.$input[0].focus();
        } else {
          currChips.selectChip(selectIndex);
        }
      }
    }
  }

  static _handleChipsKeyup(e) {
    Chips._keydown = false;
  }

  static _handleChipsBlur(e) {
    if (!Chips._keydown && document.hidden) {
      let $chips = $(e.target).closest('.chips');
      let currChips = ($chips[0] as any).M_Chips;
      currChips._selectedChip = null;
    }
  }

  _handleInputFocus() {
    this.el.classList.add('focus');
  }

  _handleInputBlur() {
    this.el.classList.remove('focus');
  }

  _handleInputKeydown(e) {
    Chips._keydown = true;
    // enter
    if (e.keyCode === 13) {
      // Override enter if autocompleting.
      if (this.hasAutocomplete && this.autocomplete && this.autocomplete.isOpen) {
        return;
      }
      e.preventDefault();
      if (!this.hasAutocomplete || (this.hasAutocomplete && !this.options.autocompleteOnly)) {
        this.addChip({id: this.$input[0].value});
      }
      this.$input[0].value = '';
      // delete or left
    } else if (
      (e.keyCode === 8 || e.keyCode === 37) &&
      this.$input[0].value === '' &&
      this.chipsData.length
    ) {
      e.preventDefault();
      this.selectChip(this.chipsData.length - 1);
    }
  }

  _renderChip(chip) {
    if (!chip.id) return;
    let renderedChip = document.createElement('div');
    let closeIcon = document.createElement('i');
    renderedChip.classList.add('chip');
    renderedChip.textContent = chip.text || chip.id;
    renderedChip.setAttribute('tabindex', "0");
    $(closeIcon).addClass('material-icons close');
    closeIcon.textContent = 'close';
    // attach image if needed
    if (chip.image) {
      let img = document.createElement('img');
      img.setAttribute('src', chip.image);
      renderedChip.insertBefore(img, renderedChip.firstChild);
    }
    renderedChip.appendChild(closeIcon);
    return renderedChip;
  }

  _renderChips() {
    this.$chips.remove();
    for (let i = 0; i < this.chipsData.length; i++) {
      let chipEl = this._renderChip(this.chipsData[i]);
      this.$el.append(chipEl);
      this.$chips.add(chipEl);
    }
    // move input to end
    this.$el.append(this.$input[0]);
  }

  _setupAutocomplete() {
    this.options.autocompleteOptions.onAutocomplete = (items) => {
      if (items.length > 0) {
        this.addChip(items[0]);
      }
      this.$input[0].value = '';
      this.$input[0].focus();
    };

    this.autocomplete = Autocomplete.init(this.$input[0], this.options.autocompleteOptions);
  }

  _setupInput() {
    this.$input = this.$el.find('input');
    if (!this.$input.length) {
      this.$input = $('<input></input>');
      this.$el.append(this.$input);
    }
    this.$input.addClass('input');
  }

  _setupLabel() {
    this.$label = this.$el.find('label');
    if (this.$label.length) {
      this.$label[0].setAttribute('for', this.$input.attr('id'));
    }
  }

  _setPlaceholder() {
    if (this.chipsData !== undefined && !this.chipsData.length && this.options.placeholder) {
      $(this.$input).prop('placeholder', this.options.placeholder);
    } else if (
      (this.chipsData === undefined || !!this.chipsData.length) &&
      this.options.secondaryPlaceholder
    ) {
      $(this.$input).prop('placeholder', this.options.secondaryPlaceholder);
    }
  }

  _isValidAndNotExist(chip) {
    const isValid = !!chip.id;
    const doesNotExist = !this.chipsData.some(item => item.id == chip.id);
    return isValid && doesNotExist;
  }

  addChip(chip) {
    if (!this._isValidAndNotExist(chip) || this.chipsData.length >= this.options.limit) {
      return;
    }
    let renderedChip = this._renderChip(chip);
    this.$chips.add(renderedChip);
    this.chipsData.push(chip);
    $(this.$input).before(renderedChip);
    this._setPlaceholder();
    // fire chipAdd callback
    if (typeof this.options.onChipAdd === 'function') {
      this.options.onChipAdd(this.$el, renderedChip);
    }
  }

  deleteChip(chipIndex) {
    let $chip = this.$chips.eq(chipIndex);
    this.$chips.eq(chipIndex).remove();
    this.$chips = this.$chips.filter(function(el) {
      return $(el).index() >= 0;
    });
    this.chipsData.splice(chipIndex, 1);
    this._setPlaceholder();

    // fire chipDelete callback
    if (typeof this.options.onChipDelete === 'function') {
      this.options.onChipDelete(this.$el, $chip[0]);
    }
  }

  selectChip(chipIndex) {
    let $chip = this.$chips.eq(chipIndex);
    this._selectedChip = $chip;
    $chip[0].focus();

    // fire chipSelect callback
    if (typeof this.options.onChipSelect === 'function') {
      this.options.onChipSelect(this.$el, $chip[0]);
    }
  }

  static Init(){
    $(document).ready(function() {
      // Handle removal of static chips.
      $(document.body).on('click', '.chip .close', function() {
        let $chips = $(this).closest('.chips');
        if ($chips.length && ($chips[0] as any).M_Chips == undefined) {
          return;
        }
        $(this)
          .closest('.chip')
          .remove();
      });
    });
  }

  static {
    Chips._keydown = false;
  }
}
