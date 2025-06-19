
import { FC } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Phone, FileText, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { toast } from "sonner";

interface AppSidebarProps {
  currentPath: string;
}

export const AppSidebar: FC<AppSidebarProps> = ({ currentPath }) => {
  const { logout } = useAuth();

  const menuItems = [
    {
      name: "Dashboard",
      path: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Campaigns",
      path: "/campaigns",
      icon: Phone,
    },
    {
      name: "Billing",
      path: "/billing",
      icon: FileText,
    },
  ];

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
  };

  return (
    <Sidebar className="border-r bg-white z-50">
      <SidebarHeader className="bg-white">
        <div className="flex items-center space-x-2 px-4 py-2">
          <img 
            src="/lovable-uploads/620a3236-a743-4779-8cde-07f0a587c6ed.png" 
            alt="Conversion Media Logo" 
            className="h-8" 
          />
          <h1 className="text-sm font-semibold">Conversion Media Group</h1>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="bg-white">
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={currentPath === item.path}>
                    <Link to={item.path}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="bg-white">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-muted-foreground hover:bg-muted"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5 mr-3" />
                Logout
              </Button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
