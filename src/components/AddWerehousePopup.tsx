import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';

interface AddWarehousePopupProps {
  isOpen: boolean;
  onClose: () => void;
  warehouse?: any;
  mode: 'add' | 'edit';
}

export const AddWarehousePopup = ({ isOpen, onClose, warehouse, mode }: AddWarehousePopupProps) => {
  const [formData, setFormData] = useState({
    name: warehouse?.name || '',
    location: warehouse?.location || '',
    capacity: warehouse?.capacity || '',
    status: warehouse?.status || 'Active',
    manager: warehouse?.manager || '',
    contactEmail: warehouse?.contactEmail || '',
    contactPhone: warehouse?.contactPhone || '',
    notes: warehouse?.notes || ''
  });

  useEffect(() => {
    if (warehouse) {
      setFormData({
        name: warehouse.name || '',
        location: warehouse.location || '',
        capacity: warehouse.capacity || '',
        status: warehouse.status || 'Active',
        manager: warehouse.manager || '',
        contactEmail: warehouse.contactEmail || '',
        contactPhone: warehouse.contactPhone || '',
        notes: warehouse.notes || ''
      });
    }
  }, [warehouse]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    // Here you would typically make an API call to save the warehouse
    console.log('Submitting warehouse data:', formData);
    onClose();
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] bg-white shadow-lg rounded-xl border border-gray-200 overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-gray-900">
            {mode === 'edit' ? 'Edit Warehouse' : 'Add Warehouse'}
          </DialogTitle>
          <DialogDescription className="text-gray-600">
            Add a new warehouse to your inventory system.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Warehouse name"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-medium text-gray-700">Location</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              placeholder="Warehouse location"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="capacity" className="text-sm font-medium text-gray-700">Capacity</Label>
            <Input
              id="capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) => handleChange('capacity', e.target.value)}
              placeholder="Storage capacity"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium text-gray-700">Status</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Full">Full</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manager" className="text-sm font-medium text-gray-700">Manager</Label>
            <Input
              id="manager"
              value={formData.manager}
              onChange={(e) => handleChange('manager', e.target.value)}
              placeholder="Warehouse manager"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail" className="text-sm font-medium text-gray-700">Contact Email</Label>
            <Input
              id="contactEmail"
              value={formData.contactEmail}
              onChange={(e) => handleChange('contactEmail', e.target.value)}
              placeholder="Manager email"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone" className="text-sm font-medium text-gray-700">Contact Phone</Label>
            <Input
              id="contactPhone"
              value={formData.contactPhone}
              onChange={(e) => handleChange('contactPhone', e.target.value)}
              placeholder="Manager phone"
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium text-gray-700">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes"
              className="bg-white h-20"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline"
              className="text-gray-600 border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer"
              onClick={onClose}
            >
              Close
            </Button>
            <Button 
              className="bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer" 
              onClick={handleSubmit}
            >
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};