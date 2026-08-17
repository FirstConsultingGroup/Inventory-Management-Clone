import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ItemFormData {
  name: string;
  description: string;
  category: string;
  manufacturer: string;
  model: string;
  unitPrice: number;
  sellingPrice: number;
  minStockLevel: number;
  maxStockLevel: number;
}

interface ItemFormProps {
  initialData?: ItemFormData & { id: string };
  onSubmit: (data: ItemFormData) => void;
}

const ItemForm: React.FC<ItemFormProps> = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = React.useState<ItemFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    category: initialData?.category || '',
    manufacturer: initialData?.manufacturer || '',
    model: initialData?.model || '',
    unitPrice: initialData?.unitPrice || 0,
    sellingPrice: initialData?.sellingPrice || 0,
    minStockLevel: initialData?.minStockLevel || 0,
    maxStockLevel: initialData?.maxStockLevel || 0,
  });

  const handleChange = (field: keyof ItemFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Sample categories - replace with actual categories from your system
  const categories = [
    'Lights',
    'Engine Parts',
    'Brake System',
    'Suspension',
    'Electrical',
    'Body Parts',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input
            required
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Enter item name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category</label>
          <Select
            value={formData.category}
            onValueChange={(value) => handleChange('category', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium mb-1">Description</label>
          <Input
            required
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Enter item description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Manufacturer</label>
          <Input
            required
            value={formData.manufacturer}
            onChange={(e) => handleChange('manufacturer', e.target.value)}
            placeholder="Enter manufacturer"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Model</label>
          <Input
            required
            value={formData.model}
            onChange={(e) => handleChange('model', e.target.value)}
            placeholder="Enter model"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Unit Price</label>
          <Input
            required
            type="number"
            min="0"
            step="0.01"
            value={formData.unitPrice}
            onChange={(e) => handleChange('unitPrice', parseFloat(e.target.value))}
            placeholder="Enter unit price"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Selling Price</label>
          <Input
            required
            type="number"
            min="0"
            step="0.01"
            value={formData.sellingPrice}
            onChange={(e) => handleChange('sellingPrice', parseFloat(e.target.value))}
            placeholder="Enter selling price"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Min Stock Level</label>
          <Input
            required
            type="number"
            min="0"
            value={formData.minStockLevel}
            onChange={(e) => handleChange('minStockLevel', parseInt(e.target.value))}
            placeholder="Enter minimum stock level"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Max Stock Level</label>
          <Input
            required
            type="number"
            min="0"
            value={formData.maxStockLevel}
            onChange={(e) => handleChange('maxStockLevel', parseInt(e.target.value))}
            placeholder="Enter maximum stock level"
          />
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button
          type="submit"
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg transition-all duration-200"
        >
          {initialData ? 'Update Item' : 'Add Item'}
        </Button>
      </div>
    </form>
  );
};

export default ItemForm;