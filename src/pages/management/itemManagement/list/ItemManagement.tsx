import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Plus, Pencil, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ItemForm from '../config/ItemForm';

interface Item {
    id: string;
    name: string;
    description: string;
    category: string;
    manufacturer: string;
    model: string;
    unitPrice: number;
    sellingPrice: number;
    minStockLevel: number;
    maxStockLevel: number;
     is_temporary?: boolean;
}

const ItemManagement = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedManufacturer, setSelectedManufacturer] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [priceRange, setPriceRange] = useState({ min: '', max: '' });
    const [stockFilter, setStockFilter] = useState({ min: '', max: '' });


    // Sample data - replace with actual API call
    const [items] = useState<Item[]>([
        {
            id: 'MARBALHD01',
            name: 'Maruti Baleno Headlight',
            description: 'Maruti headlight baleno set',
            category: 'Lights',
            manufacturer: 'Maruti Suzuki',
            model: 'Baleno',
            unitPrice: 100.50,
            sellingPrice: 120.00,
            minStockLevel: 5,
            maxStockLevel: 20
        },
        // Add more sample items as needed
    ]);

     ;

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        // Implement search logic here
    };

    const handleAddItem = (newItem: Omit<Item, 'id'>) => {
        // Implement add item logic here
        console.log('Adding new item:', newItem);
        setIsAddDialogOpen(false);
    };

    const handleEditItem = (updatedItem: Item) => {
        // Implement edit item logic here
        console.log('Updating item:', updatedItem);
        setIsEditDialogOpen(false);
        setSelectedItem(null);
    };

    // Get unique values for filters
    const categories = Array.from(new Set(items.map(item => item.category)));
    const manufacturers = Array.from(new Set(items.map(item => item.manufacturer)));
    const models = Array.from(new Set(items.map(item => item.model)));

    // Filter items
    const filteredItems = items.filter(item => {

        console.log("Item:", item);
         const matchesSearch =
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description.toLowerCase().includes(searchQuery.toLowerCase());

  const isNotTemporary = !item.is_temporary;

 

        const matchesCategory = !selectedCategory || item.category === selectedCategory;
        const matchesManufacturer = !selectedManufacturer || item.manufacturer === selectedManufacturer;
        const matchesModel = !selectedModel || item.model === selectedModel;

        const matchesPriceRange =
            (!priceRange.min || item.sellingPrice >= Number(priceRange.min)) &&
            (!priceRange.max || item.sellingPrice <= Number(priceRange.max));

        const matchesStockLevel =
            (!stockFilter.min || (item.minStockLevel >= Number(stockFilter.min))) &&
            (!stockFilter.max || (item.maxStockLevel <= Number(stockFilter.max)));

        return isNotTemporary && matchesSearch && matchesCategory && matchesManufacturer &&
            matchesModel && matchesPriceRange && matchesStockLevel;
    });

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    const handlePageChange = (pageNumber: number) => {
        setCurrentPage(pageNumber);
    };

    // Calculate visible page numbers
    const getVisiblePages = () => {
        const delta = 2; // Number of pages to show before and after current page
        const range = [];
        const rangeWithDots = [];
        let l;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
                range.push(i);
            }
        }

        for (let i of range) {
            if (l) {
                if (i - l === 2) {
                    rangeWithDots.push(l + 1);
                } else if (i - l !== 1) {
                    rangeWithDots.push('...');
                }
            }
            rangeWithDots.push(i);
            l = i;
        }

        return rangeWithDots;
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between bg-white rounded-lg shadow-sm p-4">
                <h1 className="text-2xl font-bold text-blue-700">
                    Item Management
                </h1>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg transition-all duration-200">
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Item
                        </Button>
                    </DialogTrigger>
                </Dialog>
            </div>

            <Card className="border-t-4 border-blue-500">
                <div className="p-6 space-y-6">
                    {/* Filters Section */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Package className="h-4 w-4" />
                            <span>Filters</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            <div className="relative">
                                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <Input
                                    className="pl-10"
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />
                            </div>
                        
                            <select
                                className="border rounded-md p-2 w-full bg-white"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="">All Categories</option>
                                {categories.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </select>
                        
                            <select
                                className="border rounded-md p-2 w-full bg-white"
                                value={selectedManufacturer}
                                onChange={(e) => setSelectedManufacturer(e.target.value)}
                            >
                                <option value="">All Manufacturers</option>
                                {manufacturers.map(manufacturer => (
                                    <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                                ))}
                            </select>
                        
                            <select
                                className="border rounded-md p-2 w-full bg-white"
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                            >
                                <option value="">All Models</option>
                                {models.map(model => (
                                    <option key={model} value={model}>{model}</option>
                                ))}
                            </select>
                        
                            <div className="flex gap-2 items-center">
                                <Input
                                    type="number"
                                    placeholder="Min Price"
                                    value={priceRange.min}
                                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                                    className="w-full"
                                />
                                <span className="text-gray-400">-</span>
                                <Input
                                    type="number"
                                    placeholder="Max Price"
                                    value={priceRange.max}
                                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                                    className="w-full"
                                />
                            </div>
                        
                            <div className="flex gap-2 items-center">
                                <Input
                                    type="number"
                                    placeholder="Min Stock"
                                    value={stockFilter.min}
                                    onChange={(e) => setStockFilter(prev => ({ ...prev, min: e.target.value }))}
                                    className="w-full"
                                />
                                <span className="text-gray-400">-</span>
                                <Input
                                    type="number"
                                    placeholder="Max Stock"
                                    value={stockFilter.max}
                                    onChange={(e) => setStockFilter(prev => ({ ...prev, max: e.target.value }))}
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>
                
                    {/* Table Section */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50 border-b border-gray-200">
                                    <TableHead className="font-semibold text-blue-700">Item ID</TableHead>
                                    <TableHead className="font-semibold text-blue-700">Name</TableHead>
                                    <TableHead className="font-semibold text-blue-700">Category</TableHead>
                                    <TableHead className="font-semibold text-blue-700">Manufacturer</TableHead>
                                    <TableHead className="font-semibold text-blue-700">Model</TableHead>
                                    <TableHead className="font-semibold text-blue-700">Unit Price</TableHead>
                                    <TableHead className="font-semibold text-blue-700">Selling Price</TableHead>
                                    <TableHead className="font-semibold text-blue-700">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {currentItems.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <TableCell className="font-medium">{item.id}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell>{item.manufacturer}</TableCell>
                                        <TableCell>{item.model}</TableCell>
                                        <TableCell>₹{item.unitPrice.toFixed(2)}</TableCell>
                                        <TableCell>₹{item.sellingPrice.toFixed(2)}</TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setSelectedItem(item);
                                                    setIsEditDialogOpen(true);
                                                }}
                                                className="hover:bg-blue-50 hover:text-blue-600"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                
                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                        <div className="flex flex-1 justify-between sm:hidden">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Showing page <span className="font-medium">{currentPage}</span> of{' '}
                                    <span className="font-medium">{totalPages}</span>
                                </p>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="rounded-md px-3 py-2 text-sm font-medium"
                                >
                                    Previous
                                </Button>
                            
                                <div className="flex gap-1">
                                    {getVisiblePages().map((page, index) => (
                                        typeof page === 'number' ? (
                                            <Button
                                                key={index}
                                                variant={currentPage === page ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => handlePageChange(page)}
                                                className={`rounded-md px-3 py-2 text-sm font-medium ${
                                                    currentPage === page ? 'bg-blue-600 text-white' : ''
                                                }`}
                                            >
                                                {page}
                                            </Button>
                                        ) : (
                                            <span key={index} className="px-2 py-2 text-gray-500">...</span>
                                        )
                                    ))}
                                </div>
                            
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="rounded-md px-3 py-2 text-sm font-medium"
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Dialogs */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-blue-700">Add New Item</DialogTitle>
                    </DialogHeader>
                    <ItemForm onSubmit={handleAddItem} />
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-blue-700">Edit Item</DialogTitle>
                    </DialogHeader>
                    {selectedItem && (
                        <ItemForm
                            initialData={selectedItem}
                            onSubmit={(data) => handleEditItem({ ...data, id: selectedItem.id })}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ItemManagement;