/**
 * SearchableDropdown Component
 * Creates an interactive, keyboard-navigable dropdown with search functionality
 */
export class SearchableDropdown {
  constructor(selectElement, options, placeholder = 'Select an option') {
    this.selectElement = selectElement;
    this.placeholder = placeholder;
    this.allOptions = [...options];
    this.filteredOptions = [...options];
    
    this.container = null;
    this.input = null;
    this.dropdownList = null;
    
    this.init();
  }

  init() {
    this.createElements();
    this.attachEventListeners();
    this.renderOptions();
    this.setInitialValue();
  }

  createElements() {
    // Create container
    this.container = document.createElement('div');
    this.container.className = 'searchable-dropdown';
    
    // Create input
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.className = 'dropdown-input';
    this.input.placeholder = this.placeholder;
    this.input.readOnly = true;
    
    // Create dropdown list
    this.dropdownList = document.createElement('div');
    this.dropdownList.className = 'dropdown-list';
    
    // Assemble
    this.container.appendChild(this.input);
    this.container.appendChild(this.dropdownList);
    
    // Replace original select
    this.selectElement.style.display = 'none';
    this.selectElement.parentNode.insertBefore(this.container, this.selectElement);
  }

  attachEventListeners() {
    // Input click - toggle dropdown
    this.input.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (this.input.readOnly) {
        this.openDropdown();
      }
    });

    // Input change - filter options
    this.input.addEventListener('input', (e) => {
      if (!this.input.readOnly) {
        this.filterOptions(e.target.value);
      }
    });

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => this.handleKeydown(e));

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  openDropdown() {
    this.input.readOnly = false;
    const currentValue = this.input.value;
    this.input.value = '';
    this.container.classList.add('active');
    this.input.focus();
    this.filterOptions('');
    
    // Keep current selection visible when opening
    setTimeout(() => {
      if (currentValue && currentValue !== this.allOptions[0]?.text) {
        this.input.value = '';
      }
    }, 50);
  }

  closeDropdown() {
    this.container.classList.remove('active');
    this.input.readOnly = true;
    
    // Reset input to selected value
    const selectedOption = this.allOptions.find(opt => opt.value === this.selectElement.value);
    if (selectedOption) {
      this.input.value = selectedOption.text;
    } else {
      this.input.value = this.allOptions[0]?.text || '';
    }
    
    // Remove highlighted items
    this.dropdownList.querySelectorAll('.dropdown-item').forEach(el => {
      el.classList.remove('highlighted');
    });
  }

  filterOptions(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    if (term === '') {
      this.filteredOptions = [...this.allOptions];
    } else {
      this.filteredOptions = this.allOptions.filter(option => 
        option.text.toLowerCase().includes(term)
      );
    }
    this.renderOptions();
  }

  renderOptions() {
    this.dropdownList.innerHTML = '';
    
    if (this.filteredOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results';
      noResults.textContent = 'No results found';
      this.dropdownList.appendChild(noResults);
      return;
    }
    
    this.filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = option.text;
      item.dataset.value = option.value;
      
      if (option.value === this.selectElement.value) {
        item.classList.add('selected');
      }
      
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectOption(option.value, option.text);
      });
      
      this.dropdownList.appendChild(item);
    });
  }

  selectOption(value, text) {
    this.selectElement.value = value;
    this.input.value = text;
    this.closeDropdown();
    
    // Update selected class
    this.dropdownList.querySelectorAll('.dropdown-item').forEach(el => {
      el.classList.remove('selected', 'highlighted');
    });
    
    // Trigger change event
    const event = new Event('change', { bubbles: true });
    this.selectElement.dispatchEvent(event);
  }

  handleKeydown(e) {
    if (!this.container.classList.contains('active')) return;
    
    const items = this.dropdownList.querySelectorAll('.dropdown-item:not(.no-results)');
    const currentSelected = this.dropdownList.querySelector('.dropdown-item.highlighted');
    let currentIndex = currentSelected ? Array.from(items).indexOf(currentSelected) : -1;
    
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentSelected) currentSelected.classList.remove('highlighted');
        currentIndex = (currentIndex + 1) % items.length;
        if (items[currentIndex]) items[currentIndex].classList.add('highlighted');
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (currentSelected) currentSelected.classList.remove('highlighted');
        currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        if (items[currentIndex]) items[currentIndex].classList.add('highlighted');
        break;
        
      case 'Enter':
        e.preventDefault();
        if (currentSelected) {
          const value = currentSelected.dataset.value;
          const text = currentSelected.textContent;
          this.selectOption(value, text);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  setInitialValue() {
    const initialSelectedOption = this.allOptions.find(opt => opt.value === this.selectElement.value);
    if (initialSelectedOption) {
      this.input.value = initialSelectedOption.text;
    } else if (this.allOptions.length > 0 && this.allOptions[0].value === '') {
      this.input.value = this.allOptions[0].text;
    }
  }

  updateOptions(newOptions) {
    this.allOptions = [...newOptions];
    this.filteredOptions = [...newOptions];
    this.renderOptions();
    
    const selectedOption = this.allOptions.find(opt => opt.value === this.selectElement.value);
    if (selectedOption) {
      this.input.value = selectedOption.text;
    } else if (this.allOptions.length > 0) {
      this.input.value = this.allOptions[0].text;
    }
  }

  getValue() {
    return this.selectElement.value;
  }

  setValue(value) {
    const option = this.allOptions.find(opt => opt.value === value);
    if (option) {
      this.selectOption(value, option.text);
    }
  }

  destroy() {
    this.container.remove();
    this.selectElement.style.display = '';
  }
}
