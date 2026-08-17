import React, { useEffect, useState } from "react";

import {
  AppWindow,
  CheckCircle,
  GripVertical,
  LayoutPanelLeft,
  Settings2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Label } from "@/components/ui/label";

import { supabase } from "@/Utils/types/supabaseClient";
import toast from "react-hot-toast";

interface ModuleItem {
  id: string;
  module_name: string;
  parent_id: string;
  module_order: number;
}

interface CustomizationModalProps {
  parentModules?: any[];
}

export const CustomizeListModal: React.FC<
  CustomizationModalProps
> = ({ parentModules = [] }) => {
  const [selectedParentModule, setSelectedParentModule] =
    useState<string>("");

  const [items, setItems] = useState<ModuleItem[]>([]);

  const [draggedIndex, setDraggedIndex] =
    useState<number | null>(null);

  const [open, setOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  // Fetch Modules Based On Parent Module
  const fetchModules = async (
    parentModuleId: string
  ) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("main_modules" as any)
        .select("*")
        .eq("parent_id", parentModuleId)
        .order("module_order", {
          ascending: true,
        });

      if (error) {
        console.log(error);
        return;
      }

      setItems((data as unknown as ModuleItem[]) || []);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch When Parent Module Changes
  useEffect(() => {
    if (selectedParentModule) {
      fetchModules(selectedParentModule);
    } else {
      setItems([]);
    }
  }, [selectedParentModule]);

  // Drag Start
  const handleDragStart = (
    e: React.DragEvent,
    index: number
  ) => {
    setDraggedIndex(index);

    e.dataTransfer.effectAllowed = "move";
  };

  // Drag Enter
  const handleDragEnter = (index: number) => {
    if (
      draggedIndex === null ||
      draggedIndex === index
    )
      return;

    const updatedItems = [...items];

    const draggedItem = updatedItems[draggedIndex];

    updatedItems.splice(draggedIndex, 1);

    updatedItems.splice(index, 0, draggedItem);

    setDraggedIndex(index);

    setItems(updatedItems);
  };

  // Drag End
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Save Updated Order
  const handleSave = async () => {
    try {
      setLoading(true);

      // update one by one
      for (let index = 0; index < items.length; index++) {
        const item = items[index];

        const { error } = await supabase
          .from("main_modules" as any)
          .update({
            module_order: index + 1,
          })
          .eq("id", item.id);

        if (error) {
          console.log(error);
        }
      }

      toast.success("Order updated successfully");

      setOpen(false);

      setSelectedParentModule("");

      setItems([]);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };


  const resetModal = () => {
  setSelectedParentModule("");
  setItems([]);
  setDraggedIndex(null);
};


  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
    setOpen(isOpen);

    if (!isOpen) {
      resetModal();
    }
  }}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-xl border-blue-300 text-blue-700 hover:text-blue-700 bg-blue-50 hover:bg-[#e5f2ff]"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Customize Order
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl p-6 md:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl text-blue-800">
            Customize Module Order
          </DialogTitle>
        </DialogHeader>

        {/* Parent Module Dropdown */}
        <div className="space-y-2">
          <Label className="font-medium text-gray-600 hover:text-blue-600 flex items-center gap-2">
            <AppWindow className="h-4 w-4" />

            <span>
              Parent Module{" "}
              <span className="text-red-500">*</span>
            </span>
          </Label>

          <Select
            value={selectedParentModule}
            onValueChange={(value) => {
              setSelectedParentModule(value);
            }}
          >
            <SelectTrigger className="bg-white w-full">
              <SelectValue placeholder="Select parent module" />
            </SelectTrigger>

            <SelectContent>
              {parentModules.map((module) => (
                <SelectItem
                  key={module.id}
                  value={module.id}
                >
                  {module.module_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Empty State */}
        {!selectedParentModule && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
            <LayoutPanelLeft className="h-7 w-7 mb-3 opacity-40" />

            <p className="text-sm font-medium">
              Select a parent module
            </p>

            <p>
              <strong className="text-gray-400">
                to customize module order
              </strong>
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8 text-gray-500">
            Loading...
          </div>
        )}

        {/* Drag & Drop List */}
        {!loading && (
          <div className="flex flex-col gap-3 mt-6 max-h-[42vh] overflow-y-auto pr-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, index)
                }
                onDragEnter={() =>
                  handleDragEnter(index)
                }
                onDragEnd={handleDragEnd}
                onDragOver={(e) =>
                  e.preventDefault()
                }
                className={`flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-gray-50 shadow-sm transition-all ${draggedIndex === index
                    ? "opacity-50 border-blue-500 bg-blue-50"
                    : "cursor-grab active:cursor-grabbing hover:border-blue-300"
                  }`}
              >
                <span className="font-medium text-gray-700 truncate">
                  {item.module_name}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-gray-500 hover:bg-blue-100 hover:text-blue-600 cursor-grab active:cursor-grabbing pointer-events-none"
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Save Button */}
        {selectedParentModule &&
          items.length > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="h-10 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-500"
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Update Order
              </Button>
            </div>
          )}
      </DialogContent>
    </Dialog>
  );
};