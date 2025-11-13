/**
 * Item Library
 * Pre-defined items with realistic dimensions (all VERTICAL by default)
 * lengthFt = height (vertical), widthFt = width (horizontal)
 */
const Items = {
  categories: {
    vehicles: {
      name: 'Vehicles',
      items: [
        {
          id: 'sports-car',
          label: 'Sports Car',
          lengthFt: 15,
          widthFt: 6,
          color: '#E57373',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/sports-car-side.png',
          canvasImage: 'assets/images/items/canvas/sports-car-top.png',
        },
        {
          id: 'sedan',
          label: 'Sedan',
          lengthFt: 16,
          widthFt: 6,
          color: '#64B5F6',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/sedan-side.png',
          canvasImage: 'assets/images/items/canvas/sedan-top.png',
        },
        {
          id: 'pickup',
          label: 'Pickup Truck',
          lengthFt: 19,
          widthFt: 6.5,
          color: '#81C784',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/pickup-side.png',
          canvasImage: 'assets/images/items/canvas/pickup-top.png',
        },
        {
          id: 'suv',
          label: 'SUV',
          lengthFt: 17,
          widthFt: 6.5,
          color: '#BA68C8',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/suv-side.png',
          canvasImage: 'assets/images/items/canvas/suv-top.png',
        },
        {
          id: 'motorcycle',
          label: 'Motorcycle',
          lengthFt: 7,
          widthFt: 3,
          color: '#FFB74D',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/motorcycle-side.png',
          canvasImage: 'assets/images/items/canvas/motorcycle-top.png',
        },
        {
          id: 'van',
          label: 'Van',
          lengthFt: 18,
          widthFt: 6.5,
          color: '#A1887F',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/van-side.png',
          canvasImage: 'assets/images/items/canvas/van-top.png',
        },
      ],
    },
    recreational: {
      name: 'Recreational Vehicles',
      items: [
        {
          id: 'boat-trailer',
          label: 'Boat with Trailer',
          lengthFt: 20,
          widthFt: 7,
          color: '#4DD0E1',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/boat-trailer-side.png',
          canvasImage: 'assets/images/items/canvas/boat-trailer-top.png',
        },
        {
          id: 'rv-26',
          label: 'RV (26 ft)',
          lengthFt: 26,
          widthFt: 8,
          color: '#AED581',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/rv-26-side.png',
          canvasImage: 'assets/images/items/canvas/rv-26-top.png',
        },
        {
          id: 'rv-34',
          label: 'RV (34 ft)',
          lengthFt: 34,
          widthFt: 8.5,
          color: '#DCE775',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/rv-34-side.png',
          canvasImage: 'assets/images/items/canvas/rv-34-top.png',
        },
        {
          id: 'jet-ski-trailer',
          label: 'Jet Ski with Trailer',
          lengthFt: 12,
          widthFt: 5,
          color: '#4FC3F7',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/jet-ski-trailer-side.png',
          canvasImage: 'assets/images/items/canvas/jet-ski-trailer-top.png',
        },
        {
          id: 'atv',
          label: 'ATV',
          lengthFt: 7,
          widthFt: 4,
          color: '#FFD54F',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/atv-side.png',
          canvasImage: 'assets/images/items/canvas/atv-top.png',
        },
        {
          id: 'golf-cart',
          label: 'Golf Cart',
          lengthFt: 8,
          widthFt: 4,
          color: '#90CAF9',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/golf-cart-side.png',
          canvasImage: 'assets/images/items/canvas/golf-cart-top.png',
        },
      ],
    },
    storage: {
      name: 'Storage & Furniture',
      items: [
        {
          id: 'shelf',
          label: 'Storage Shelf',
          lengthFt: 4,
          widthFt: 2,
          color: '#90A4AE',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/shelf-side.png',
          canvasImage: 'assets/images/items/canvas/shelf-top.png',
        },
        {
          id: 'workbench',
          label: 'Workbench',
          lengthFt: 6,
          widthFt: 2.5,
          color: '#8D6E63',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/workbench-side.png',
          canvasImage: 'assets/images/items/canvas/workbench-top.png',
        },
        {
          id: 'storage-box',
          label: 'Storage Box',
          lengthFt: 3,
          widthFt: 3,
          color: '#B0BEC5',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/storage-box-side.png',
          canvasImage: 'assets/images/items/canvas/storage-box-top.png',
        },
        {
          id: 'tool-cabinet',
          label: 'Tool Cabinet',
          lengthFt: 5,
          widthFt: 2,
          color: '#EF5350',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/tool-cabinet-side.png',
          canvasImage: 'assets/images/items/canvas/tool-cabinet-top.png',
        },
        {
          id: 'bike-rack',
          label: 'Bike Rack',
          lengthFt: 6,
          widthFt: 2,
          color: '#42A5F5',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/bike-rack-side.png',
          canvasImage: 'assets/images/items/canvas/bike-rack-top.png',
        },
        {
          id: 'freezer',
          label: 'Chest Freezer',
          lengthFt: 5,
          widthFt: 2.5,
          color: '#ECEFF1',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/freezer-side.png',
          canvasImage: 'assets/images/items/canvas/freezer-top.png',
        },
        {
          id: 'scaffold-rack',
          label: 'Scaffold Rack',
          lengthFt: 8,
          widthFt: 1.5,
          color: '#FFA726',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/scaffold-side.png',
          canvasImage: 'assets/images/items/canvas/scaffold-top.png',
        },
        {
          id: 'kayak',
          label: 'Kayak',
          lengthFt: 12,
          widthFt: 2.8,
          color: '#A1887F',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/kayak-side.png',
          canvasImage: 'assets/images/items/canvas/kayak-top.png',
        },
        {
          id: 'small-tool-box',
          label: 'Tool Box',
          lengthFt: 3,
          widthFt: 1.5,
          color: '#90A4AE',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/small-tool-box-side.png',
          canvasImage: 'assets/images/items/canvas/small-tool-box-top.png',
        },
        {
          id: 'car-lift',
          label: 'Car Lift',
          lengthFt: 15,
          widthFt: 9,
          color: '#EF5350',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/car-lift-side.png',
          canvasImage: 'assets/images/items/canvas/car-lift-top.png',
        },
      ],
    },
  },

  /**
   * Get all items
   */
  getAll() {
    const allItems = [];
    for (const category in this.categories) {
      allItems.push(...this.categories[category].items);
    }
    return allItems;
  },

  /**
   * Get item by ID
   */
  getById(id) {
    return this.getAll().find((item) => item.id === id);
  },

  /**
   * Get items by category
   */
  getByCategory(categoryName) {
    return this.categories[categoryName]?.items || [];
  },

  /**
   * Get all category names
   */
  getCategoryNames() {
    return Object.keys(this.categories);
  },

  /**
   * Search items by name
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(
      (item) =>
        item.label.toLowerCase().includes(lowerQuery) || item.id.toLowerCase().includes(lowerQuery),
    );
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.Items = Items;
}
