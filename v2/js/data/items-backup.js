/**
 * Item Library - REORGANIZED FOR LOGICAL GROUPING
 * Pre-defined items with realistic dimensions (all VERTICAL by default)
 * lengthFt = height (vertical), widthFt = width (horizontal)
 *
 * Each category is organized into logical sub-groups for better UX
 */
const Items = {
  categories: {
    vehicles: {
      name: 'Vehicles',
      items: [
        // === CARS ===
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
          id: 'classic-convertible-car',
          label: 'Classic Convertible',
          lengthFt: 16,
          widthFt: 6,
          color: '#EF5350',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/classic-convertible-car-side.png',
          canvasImage: 'assets/images/items/canvas/classic-convertible-car-top.png',
        },
        {
          id: 'classic-muscle-car',
          label: 'Classic Muscle Car',
          lengthFt: 17,
          widthFt: 6.5,
          color: '#42A5F5',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/classic-muscle-car-side.png',
          canvasImage: 'assets/images/items/canvas/classic-muscle-car-top.png',
        },
        {
          id: 'vintage-sports-car',
          label: 'Vintage Sports Car',
          lengthFt: 15,
          widthFt: 5.5,
          color: '#EC407A',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/vintage-sports-car-side.png',
          canvasImage: 'assets/images/items/canvas/vintage-sports-car-top.png',
        },
        {
          id: 'race-car',
          label: 'Race Car',
          lengthFt: 16,
          widthFt: 6.5,
          color: '#F44336',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/race-car-side.png',
          canvasImage: 'assets/images/items/canvas/race-car-top.png',
        },
        {
          id: 'supercar',
          label: 'Supercar',
          lengthFt: 15,
          widthFt: 6,
          color: '#FF5722',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/supercar-side.png',
          canvasImage: 'assets/images/items/canvas/supercar-top.png',
        },

        // === TRUCKS & UTILITY VEHICLES ===
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
          id: 'van',
          label: 'Van',
          lengthFt: 18,
          widthFt: 6.5,
          color: '#A1887F',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/van-side.png',
          canvasImage: 'assets/images/items/canvas/van-top.png',
        },
        {
          id: 'off-road-4x4-truck',
          label: 'Off-Road 4x4',
          lengthFt: 18,
          widthFt: 6.5,
          color: '#8D6E63',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/off-road-4x4-truck-side.png',
          canvasImage: 'assets/images/items/canvas/off-road-4x4-truck-top.png',
        },
        {
          id: 'semi-truck-cabin',
          label: 'Semi Truck',
          lengthFt: 20,
          widthFt: 8,
          color: '#607D8B',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/semi-truck-cabin-side.png',
          canvasImage: 'assets/images/items/canvas/semi-truck-cabin-top.png',
        },
        {
          id: 'food-truck',
          label: 'Food Truck',
          lengthFt: 20,
          widthFt: 8,
          color: '#FFA726',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/food-truck-side.png',
          canvasImage: 'assets/images/items/canvas/food-truck-top.png',
        },

        // === MOTORCYCLES & BIKES ===
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
          id: 'vintage-cruiser-motorcycle',
          label: 'Vintage Cruiser',
          lengthFt: 8,
          widthFt: 3,
          color: '#9575CD',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/vintage-cruiser-motorcycle-side.png',
          canvasImage: 'assets/images/items/canvas/vintage-cruiser-motorcycle-top.png',
        },
        {
          id: 'dirt-bike',
          label: 'Dirt Bike',
          lengthFt: 7,
          widthFt: 2.5,
          color: '#29B6F6',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/dirt-bike-side.png',
          canvasImage: 'assets/images/items/canvas/dirt-bike-top.png',
        },

        // === RVs & CAMPERS ===
        {
          id: 'motorhome',
          label: 'Motorhome',
          lengthFt: 28,
          widthFt: 8.5,
          color: '#78909C',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/motorhome-side.png',
          canvasImage: 'assets/images/items/canvas/motorhome-top.png',
        },
        {
          id: 'airspresso-coffee-food-trailer',
          label: 'Coffee Trailer',
          lengthFt: 12,
          widthFt: 6,
          color: '#A1887F',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/airspresso-coffee-food-trailer-side.png',
          canvasImage: 'assets/images/items/canvas/airspresso-coffee-food-trailer-top.png',
        },
        {
          id: 'teardrop-camper',
          label: 'Teardrop Camper',
          lengthFt: 12,
          widthFt: 5,
          color: '#4DB6AC',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/teardrop-camper-side.png',
          canvasImage: 'assets/images/items/canvas/teardrop-camper-top.png',
        },

        // === SPECIALTY VEHICLES ===
        {
          id: 'tractor',
          label: 'Tractor',
          lengthFt: 12,
          widthFt: 6,
          color: '#43A047',
          category: 'vehicles',
          paletteImage: 'assets/images/items/palette/tractor-side.png',
          canvasImage: 'assets/images/items/canvas/tractor-top.png',
        },
      ],
    },

    recreational: {
      name: 'Recreational',
      items: [
        // === BOATS & WATERCRAFT ===
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
          id: 'speed-boat-trailer',
          label: 'Speed Boat w/ Trailer',
          lengthFt: 20,
          widthFt: 7,
          color: '#26C6DA',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/speed-boat-trailer-side.png',
          canvasImage: 'assets/images/items/canvas/speed-boat-trailer-top.png',
        },
        {
          id: 'speedboat',
          label: 'Speedboat',
          lengthFt: 18,
          widthFt: 6,
          color: '#00ACC1',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/speedboat-side.png',
          canvasImage: 'assets/images/items/canvas/Speedboat-top.png',
        },
        {
          id: 'pontoonboat',
          label: 'Pontoon Boat',
          lengthFt: 22,
          widthFt: 8.5,
          color: '#0097A7',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/pontoonboat-side.png',
          canvasImage: 'assets/images/items/canvas/pontoon-boat-top.png',
        },
        {
          id: 'inflatable-boat',
          label: 'Inflatable Boat',
          lengthFt: 12,
          widthFt: 5,
          color: '#00838F',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/inflatable-boat-side.png',
          canvasImage: 'assets/images/items/canvas/inflatable-boat-top.png',
        },
        {
          id: 'small-sailboat',
          label: 'Small Sailboat',
          lengthFt: 16,
          widthFt: 6,
          color: '#006064',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/small-sailboat-side.png',
          canvasImage: 'assets/images/items/canvas/small-sailboat-top.png',
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

        // === RVs ===
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

        // === OFF-ROAD & RECREATION ===
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
        {
          id: 'polaris-slingshot-strike',
          label: 'Polaris Slingshot',
          lengthFt: 11,
          widthFt: 6,
          color: '#D32F2F',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/polaris-slingshot-strike-side.png',
          canvasImage: 'assets/images/items/canvas/polaris-slingshot-strike-top.png',
        },
        {
          id: 'snowmobile',
          label: 'Snowmobile',
          lengthFt: 10,
          widthFt: 4,
          color: '#1976D2',
          category: 'recreational',
          paletteImage: 'assets/images/items/palette/snowmobile-side.png',
          canvasImage: 'assets/images/items/canvas/snowmobile-top.png',
        },
      ],
    },

    workshop: {
      name: 'Workshop & Tools',
      items: [
        // === AIR TOOLS ===
        {
          id: 'air-compressor',
          label: 'Air Compressor',
          lengthFt: 2,
          widthFt: 4.5,
          color: '#FFB300',
          category: 'workshop',
          paletteImage: 'assets/images/items/palette/air-compressor-side.png',
          canvasImage: 'assets/images/items/canvas/air-compressor-top.png',
        },

        // === POWER TOOLS & MACHINES ===
        {
          id: 'cement-mixer',
          label: 'Cement Mixer',
          lengthFt: 4,
          widthFt: 3,
          color: '#FF6F00',
          category: 'workshop',
          paletteImage: 'assets/images/items/palette/cement-mixer-side.png',
          canvasImage: 'assets/images/items/canvas/cement-mixer-top.png',
        },
        {
          id: 'portable-welding-machine',
          label: 'Welding Machine',
          lengthFt: 2.5,
          widthFt: 2,
          color: '#FBC02D',
          category: 'workshop',
          paletteImage: 'assets/images/items/palette/portable-welding-machine-side.png',
          canvasImage: 'assets/images/items/canvas/portable-welding-machine-top.png',
        },
        {
          id: 'cnc-machine',
          label: 'CNC Machine',
          lengthFt: 8,
          widthFt: 4,
          color: '#689F38',
          category: 'workshop',
          paletteImage: 'assets/images/items/palette/cnc-machine-side.png',
          canvasImage: 'assets/images/items/canvas/cnc-machine-top.png',
        },

        // === LIFTS & ACCESS ===
        {
          id: 'scissor-lift',
          label: 'Scissor Lift',
          lengthFt: 8,
          widthFt: 5,
          color: '#FF9800',
          category: 'workshop',
          paletteImage: 'assets/images/items/palette/scissor-lift-side.png',
          canvasImage: 'assets/images/items/canvas/scissor-lift-top.png',
        },
        {
          id: 'metal-staircase',
          label: 'Metal Staircase',
          lengthFt: 10,
          widthFt: 3,
          color: '#757575',
          category: 'workshop',
          paletteImage: 'assets/images/items/palette/metal-staircase-side.png',
          canvasImage: 'assets/images/items/canvas/metal-staircase-top.png',
        },

        // === TOOL STORAGE ===
        {
          id: 'rolling-tool-chest',
          label: 'Rolling Tool Chest',
          lengthFt: 4,
          widthFt: 2,
          color: '#424242',
          category: 'workshop',
          paletteImage: 'assets/images/items/palette/rolling-tool-chest-side.png',
          canvasImage: 'assets/images/items/canvas/rolling-tool-chest-top.png',
        },
      ],
    },

    garage_equipment: {
      name: 'Garage Equipment',
      items: [
        // === AUTO SERVICE EQUIPMENT ===
        {
          id: 'car-lift',
          label: 'Car Lift',
          lengthFt: 15,
          widthFt: 9,
          color: '#EF5350',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/car-lift-side.png',
          canvasImage: 'assets/images/items/canvas/car-lift-top.png',
        },
        {
          id: 'car-jack',
          label: 'Car Jack',
          lengthFt: 2,
          widthFt: 1.5,
          color: '#424242',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/car-jack-side.png',
          canvasImage: 'assets/images/items/canvas/car-jack-top.png',
        },
        {
          id: 'floor-jack',
          label: 'Floor Jack',
          lengthFt: 3,
          widthFt: 2,
          color: '#EF5350',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/floor-jack-side.png',
          canvasImage: 'assets/images/items/canvas/floor-jack-top.png',
        },
        {
          id: 'mechanic-creeper-slider',
          label: 'Mechanic Creeper',
          lengthFt: 4,
          widthFt: 2,
          color: '#D32F2F',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/mechanic-creeper-slider-side.png',
          canvasImage: 'assets/images/items/canvas/mechanic-creeper-slider-top.png',
        },

        // === CLEANING EQUIPMENT ===
        {
          id: 'pressure-washer-machine',
          label: 'Pressure Washer',
          lengthFt: 3,
          widthFt: 2,
          color: '#FDD835',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/pressure-washer-machine-side.png',
          canvasImage: 'assets/images/items/canvas/pressure-washer-machine-top.png',
        },

        // === STORAGE SYSTEMS ===
        {
          id: 'garage-pegboard',
          label: 'Garage Pegboard',
          lengthFt: 8,
          widthFt: 2,
          color: '#E53935',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/garage-pegboard-side.png',
          canvasImage: 'assets/images/items/canvas/garage-pegboard-top.png',
        },
        {
          id: 'garage-cabinets-with-shelves',
          label: 'Garage Cabinets',
          lengthFt: 8,
          widthFt: 2,
          color: '#1976D2',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/garage-cabinets-with-shelves-side.png',
          canvasImage: 'assets/images/items/canvas/garage-cabinets-with-shel...-top.png',
        },
        {
          id: 'metal-garage-cabinet',
          label: 'Metal Cabinet',
          lengthFt: 6,
          widthFt: 2,
          color: '#37474F',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/metal-garage-cabinet-side.png',
          canvasImage: 'assets/images/items/canvas/metal-garage-cabinet-top.png',
        },
        {
          id: 'storage-ladder',
          label: 'Storage Ladder',
          lengthFt: 8,
          widthFt: 2,
          color: '#BDBDBD',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/storage-ladder-side.png',
          canvasImage: 'assets/images/items/canvas/storage-ladder-top.png',
        },

        // === PARTS & SUPPLIES ===
        {
          id: 'car-tires',
          label: 'Car Tires (Stack)',
          lengthFt: 2.5,
          widthFt: 2.5,
          color: '#212121',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/car-tires-side.png',
          canvasImage: 'assets/images/items/canvas/car-tires-top.png',
        },

        // === APPLIANCES ===
        {
          id: 'garage-refrigerator',
          label: 'Garage Refrigerator',
          lengthFt: 6,
          widthFt: 3,
          color: '#ECEFF1',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/garage-refrigerator-side.png',
          canvasImage: 'assets/images/items/canvas/garage-refrigerator-top.png',
        },

        // === INFRASTRUCTURE ===
        {
          id: 'garage-door',
          label: 'Garage Door',
          lengthFt: 16,
          widthFt: 7,
          color: '#9E9E9E',
          category: 'garage_equipment',
          paletteImage: 'assets/images/items/palette/garage-door-side.png',
          canvasImage: 'assets/images/items/canvas/garage-door-top.png',
        },
      ],
    },

    furniture: {
      name: 'Furniture & Living',
      items: [
        // === SEATING ===
        {
          id: 'sofa',
          label: 'Couch',
          lengthFt: 8,
          widthFt: 3,
          color: '#8B5CF6',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/sofa-side.png',
          canvasImage: 'assets/images/items/canvas/sofa-top.png',
        },
        {
          id: 'l-shaped-sofa',
          label: 'L-Shaped Sofa',
          lengthFt: 9,
          widthFt: 6,
          color: '#5E35B1',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/l-shaped-sofa-side.png',
          canvasImage: 'assets/images/items/canvas/l-shaped-sofa-top.png',
        },

        // === TABLES ===
        {
          id: 'dining-table',
          label: 'Dining Table',
          lengthFt: 6,
          widthFt: 4,
          color: '#D7CCC8',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/dinning-table-side.png',
          canvasImage: 'assets/images/items/canvas/dinning-table-top.png',
        },
        {
          id: 'coffee-table',
          label: 'Coffee Table',
          lengthFt: 2.5,
          widthFt: 4,
          color: '#6D4C41',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/coffee-table-side.png',
          canvasImage: 'assets/images/items/canvas/coffee-table-top.png',
        },
        {
          id: 'coffee-table-circular',
          label: 'Coffee Table (Round)',
          lengthFt: 3,
          widthFt: 3,
          color: '#5D4037',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/coffee-table-circular-side.png',
          canvasImage: 'assets/images/items/canvas/coffee-table-circular-top.png',
        },

        // === CHAIRS ===
        {
          id: 'massage-chair',
          label: 'Massage Chair',
          lengthFt: 5,
          widthFt: 3,
          color: '#8D6E63',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/massage-chair-side.png',
          canvasImage: 'assets/images/items/canvas/massage-chair-top.png',
        },
        {
          id: 'aeron-chair',
          label: 'Office Chair',
          lengthFt: 3,
          widthFt: 2.5,
          color: '#455A64',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/aeron-chair-side.png',
          canvasImage: 'assets/images/items/canvas/aeron-chair-top.png',
        },
        {
          id: 'gaming-chair',
          label: 'Gaming Chair',
          lengthFt: 3.5,
          widthFt: 2.5,
          color: '#1E88E5',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/gaming-chair-side.png',
          canvasImage: 'assets/images/items/canvas/gaming-chair-top.png',
        },

        // === ENTERTAINMENT FURNITURE ===
        {
          id: 'tv-stand',
          label: 'TV Stand',
          lengthFt: 5,
          widthFt: 1.5,
          color: '#4E342E',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/tv-stand-side.png',
          canvasImage: 'assets/images/items/canvas/tv-stand-top.png',
        },
        {
          id: 'tv',
          label: 'TV (Flat Screen)',
          lengthFt: 5,
          widthFt: 3,
          color: '#212121',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/tv-side.png',
          canvasImage: 'assets/images/items/canvas/tv-top.png',
        },

        // === KITCHEN APPLIANCES ===
        {
          id: 'double-door-fridge',
          label: 'Refrigerator',
          lengthFt: 6,
          widthFt: 3,
          color: '#CFD8DC',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/double-door-fridge-side.png',
          canvasImage: 'assets/images/items/canvas/double-door-fridge-top.png',
        },
        {
          id: 'mini-refrigerator',
          label: 'Mini Fridge',
          lengthFt: 3,
          widthFt: 2.5,
          color: '#EF5350',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/mini-refrigerator-side.png',
          canvasImage: 'assets/images/items/canvas/mini-refrigerator-top.png',
        },
        {
          id: 'water-cooler',
          label: 'Water Cooler',
          lengthFt: 4,
          widthFt: 1.5,
          color: '#42A5F5',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/water-cooler-side.png',
          canvasImage: 'assets/images/items/canvas/water-cooler-top.png',
        },
        {
          id: 'washing-machine',
          label: 'Washing Machine',
          lengthFt: 3,
          widthFt: 2.5,
          color: '#90A4AE',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/washing-machine-side.png',
          canvasImage: 'assets/images/items/canvas/washing-machine-top.png',
        },

        // === DECOR ===
        {
          id: 'carpet-circular',
          label: 'Carpet (Round)',
          lengthFt: 6,
          widthFt: 6,
          color: '#BCAAA4',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/carpet-circular-side.png',
          canvasImage: 'assets/images/items/canvas/carpet-circular-top.png',
        },
        {
          id: 'rug-rectangular',
          label: 'Rug',
          lengthFt: 8,
          widthFt: 5,
          color: '#FF7043',
          category: 'furniture',
          paletteImage: 'assets/images/items/palette/rug-rectangular-side.png',
          canvasImage: 'assets/images/items/canvas/rug-rectangular-top.png',
        },
      ],
    },

    fitness: {
      name: 'Fitness & Sports',
      items: [
        // === CARDIO EQUIPMENT ===
        {
          id: 'treadmill',
          label: 'Treadmill',
          lengthFt: 6,
          widthFt: 3,
          color: '#424242',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/treadmill-side.png',
          canvasImage: 'assets/images/items/canvas/treadmill-top.png',
        },
        {
          id: 'exercise-bike',
          label: 'Exercise Bike',
          lengthFt: 4,
          widthFt: 2,
          color: '#37474F',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/exercise-bike-side.png',
          canvasImage: 'assets/images/items/canvas/exercise-bike-top.png',
        },
        {
          id: 'bicycle-gym-equipment',
          label: 'Stationary Bike',
          lengthFt: 5,
          widthFt: 2,
          color: '#546E7A',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/bicycle-gym-equipment-side.png',
          canvasImage: 'assets/images/items/canvas/bicycle-gym-equipment-top.png',
        },

        // === STRENGTH EQUIPMENT ===
        {
          id: 'bench-press',
          label: 'Bench Press',
          lengthFt: 5,
          widthFt: 4,
          color: '#212121',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/bench-press-side.png',
          canvasImage: 'assets/images/items/canvas/bench-press-top.png',
        },
        {
          id: 'dumbbell-rack',
          label: 'Dumbbell Rack',
          lengthFt: 5,
          widthFt: 2,
          color: '#263238',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/dumbbell-rack-side.png',
          canvasImage: 'assets/images/items/canvas/dumbbell-rack-top.png',
        },
        {
          id: 'climb-gym',
          label: 'Climbing Gym',
          lengthFt: 7,
          widthFt: 3,
          color: '#455A64',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/climb-gym-side.png',
          canvasImage: 'assets/images/items/canvas/climb-gym-top.png',
        },
        {
          id: 'punching-bag-hanging',
          label: 'Punching Bag',
          lengthFt: 4,
          widthFt: 1.5,
          color: '#1A237E',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/punching-bag-hanging-side.png',
          canvasImage: 'assets/images/items/canvas/punching-bag-hanging-top.png',
        },

        // === RECREATION GAMES ===
        {
          id: 'table-tennis',
          label: 'Table Tennis',
          lengthFt: 9,
          widthFt: 5,
          color: '#1976D2',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/table-tennis-side.png',
          canvasImage: 'assets/images/items/canvas/table-tennis-top.png',
        },
        {
          id: 'fosball',
          label: 'Foosball Table',
          lengthFt: 5,
          widthFt: 3,
          color: '#388E3C',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/foosball-side.png',
          canvasImage: 'assets/images/items/canvas/foosball-top.png',
        },

        // === OUTDOOR RECREATION ===
        {
          id: 'inflatable-swimming-ring',
          label: 'Pool Float',
          lengthFt: 4,
          widthFt: 4,
          color: '#FF9800',
          category: 'fitness',
          paletteImage: 'assets/images/items/palette/inflatable-swimming-ring-side.png',
          canvasImage: 'assets/images/items/canvas/inflatable-swimmin...g-top.png',
        },
      ],
    },

    storage: {
      name: 'Storage & Organization',
      items: [
        // === SHELVING SYSTEMS ===
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
          id: 'shelf-boxes',
          label: 'Shelf with Boxes',
          lengthFt: 4,
          widthFt: 3,
          color: '#A1887F',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/shelf-boxes-side.png',
          canvasImage: 'assets/images/items/canvas/shelf-boxes-top.png',
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

        // === WORKSTATIONS ===
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

        // === BOXES & CONTAINERS ===
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
          id: 'box',
          label: 'Cardboard Box',
          lengthFt: 2.5,
          widthFt: 2.5,
          color: '#A1887F',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/box-side.png',
          canvasImage: 'assets/images/items/canvas/box-top.png',
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

        // === SPECIALTY STORAGE ===
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
          id: 'kayak',
          label: 'Kayak',
          lengthFt: 12,
          widthFt: 2.8,
          color: '#A1887F',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/kayak-side.png',
          canvasImage: 'assets/images/items/canvas/kayak-top.png',
        },

        // === APPLIANCES ===
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

        // === MISCELLANEOUS ===
        {
          id: 'floor-lamp',
          label: 'Floor Lamp',
          lengthFt: 6,
          widthFt: 1,
          color: '#FDD835',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/floor-lamp-side.png',
          canvasImage: 'assets/images/items/canvas/floor-lamp-top.png',
        },
        {
          id: 'electric-car-charging',
          label: 'EV Charger',
          lengthFt: 5,
          widthFt: 1.5,
          color: '#66BB6A',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/electric-car-charging-side.png',
          canvasImage: 'assets/images/items/canvas/electric-car-charging-top.png',
        },
        {
          id: 'hot-dog-cart',
          label: 'Hot Dog Cart',
          lengthFt: 6,
          widthFt: 3,
          color: '#EF5350',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/hot-dog-cart-side.png',
          canvasImage: 'assets/images/items/canvas/hot-dog-cart-top.png',
        },
        {
          id: 'garage-bar-counter',
          label: 'Bar Counter',
          lengthFt: 6,
          widthFt: 2.5,
          color: '#6D4C41',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/garage-bar-counter-side.png',
          canvasImage: 'assets/images/items/canvas/garage-bar-counter-top.png',
        },
        {
          id: 'wheel-barrow',
          label: 'Wheelbarrow',
          lengthFt: 5,
          widthFt: 2.5,
          color: '#C62828',
          category: 'storage',
          paletteImage: 'assets/images/items/palette/wheel-barrow-side.png',
          canvasImage: 'assets/images/items/canvas/wheel-barrow-top.png',
        },
      ],
    },

    entertainment: {
      name: 'Entertainment',
      items: [
        // === GAMING & ARCADE ===
        {
          id: 'pool-table',
          label: 'Pool Table',
          lengthFt: 9,
          widthFt: 5,
          color: '#10B981',
          category: 'entertainment',
          paletteImage: 'assets/images/items/palette/pool-table-side.png',
          canvasImage: 'assets/images/items/canvas/pool-table-top.png',
        },
        {
          id: 'fliperama',
          label: 'Arcade Game',
          lengthFt: 6,
          widthFt: 3,
          color: '#D32F2F',
          category: 'entertainment',
          paletteImage: 'assets/images/items/palette/fliperama-side.png',
          canvasImage: 'assets/images/items/canvas/fliperama-top.png',
        },
        {
          id: 'racing-simulator',
          label: 'Racing Simulator',
          lengthFt: 5,
          widthFt: 4,
          color: '#1976D2',
          category: 'entertainment',
          paletteImage: 'assets/images/items/palette/racing-simulator-side.png',
          canvasImage: 'assets/images/items/canvas/racing-simulator-top.png',
        },

        // === OUTDOOR ENTERTAINING ===
        {
          id: 'bbq-grill',
          label: 'BBQ Grill',
          lengthFt: 4,
          widthFt: 2.5,
          color: '#424242',
          category: 'entertainment',
          paletteImage: 'assets/images/items/palette/bbq-grill-side.png',
          canvasImage: 'assets/images/items/canvas/bbq-grill-top.png',
        },
        {
          id: 'gas-grill',
          label: 'Gas Grill',
          lengthFt: 5,
          widthFt: 2.5,
          color: '#616161',
          category: 'entertainment',
          paletteImage: 'assets/images/items/palette/gas-grill-side.png',
          canvasImage: 'assets/images/items/canvas/gas-grill-top.png',
        },
      ],
    },

    mezzanine: {
      name: 'Mezzanine Options',
      items: [
        {
          id: 'mezzanine-option-1',
          label: 'Mezzanine Option 1',
          lengthFt: 14,
          widthFt: 11,
          color: '#9CA3AF',
          category: 'mezzanine',
          paletteImage: null,
          canvasImage: null,
        },
        {
          id: 'mezzanine-option-2',
          label: 'Mezzanine Option 2',
          lengthFt: 16,
          widthFt: 15,
          color: '#9CA3AF',
          category: 'mezzanine',
          paletteImage: null,
          canvasImage: null,
        },
        {
          id: 'mezzanine-option-3',
          label: 'Mezzanine Option 3',
          lengthFt: 17,
          widthFt: 14,
          color: '#9CA3AF',
          category: 'mezzanine',
          paletteImage: null,
          canvasImage: null,
        },
        {
          id: 'mezzanine-option-4',
          label: 'Mezzanine Option 4',
          lengthFt: 18,
          widthFt: 16,
          color: '#9CA3AF',
          category: 'mezzanine',
          paletteImage: null,
          canvasImage: null,
        },
        {
          id: 'mezzanine-option-5',
          label: 'Mezzanine Option 5',
          lengthFt: 22,
          widthFt: 18,
          color: '#9CA3AF',
          category: 'mezzanine',
          paletteImage: null,
          canvasImage: null,
        },
      ],
    },

    shapes: {
      name: '2D Shapes',
      items: [
        {
          id: 'shape-square',
          label: 'Square',
          lengthFt: 10,
          widthFt: 10,
          color: '#94A3B8',
          category: 'shapes',
          shapeType: 'square',
          paletteImage: null,
          canvasImage: null,
        },
        {
          id: 'shape-circle',
          label: 'Circle',
          lengthFt: 10,
          widthFt: 10,
          color: '#7C8BA1',
          category: 'shapes',
          shapeType: 'circle',
          paletteImage: null,
          canvasImage: null,
        },
        {
          id: 'shape-rectangle',
          label: 'Rectangle',
          lengthFt: 12,
          widthFt: 6,
          color: '#5E6A7D',
          category: 'shapes',
          shapeType: 'rectangle',
          paletteImage: null,
          canvasImage: null,
        },
        {
          id: 'shape-triangle',
          label: 'Triangle',
          lengthFt: 9,
          widthFt: 8,
          color: '#7E8C9B',
          category: 'shapes',
          shapeType: 'triangle',
          paletteImage: null,
          canvasImage: null,
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
