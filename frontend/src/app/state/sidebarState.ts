class SidebarState {
  private listeners: ((value: boolean) => void)[] = [];
  collapsed = false;

  subscribe(listener: (value: boolean) => void) {
    this.listeners.push(listener);

    // send current value immediately
    listener(this.collapsed);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  toggle() {
    this.collapsed = !this.collapsed;
    this.emit();
  }

  set(value: boolean) {
    this.collapsed = value;
    this.emit();
  }

  private emit() {
    this.listeners.forEach((l) => l(this.collapsed));
  }
}

export const sidebarState = new SidebarState();