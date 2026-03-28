import { html, nothing, type TemplateResult } from "lit";

export interface DropdownItem {
  id: string;
  label: string;
  description?: string;
  icon?: string | TemplateResult;
  badge?: string;
  checked?: boolean;
}

export interface DropdownProps {
  items: DropdownItem[];
  open: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchQuery?: string;
  onSelect: (id: string) => void;
  onSearch?: (query: string) => void;
  onClose: () => void;
  position?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  emptyText?: string;
}

export function renderDropdown(props: DropdownProps): TemplateResult {
  if (!props.open) {
    return html`${nothing}`;
  }

  const pos = props.position ?? "bottom-left";
  const filtered = props.searchQuery
    ? props.items.filter(
        (i) =>
          i.label.toLowerCase().includes(props.searchQuery!.toLowerCase()) ||
          i.description?.toLowerCase().includes(props.searchQuery!.toLowerCase()),
      )
    : props.items;

  return html`
		<div
			class="ge-dropdown ge-dropdown--${pos}"
			@click=${(e: Event) => e.stopPropagation()}
		>
			${
        props.searchable
          ? html`
						<div class="ge-dropdown__search">
							<input
								type="text"
								placeholder="${props.searchPlaceholder ?? "Search..."}"
								.value=${props.searchQuery ?? ""}
								@input=${(e: Event) => props.onSearch?.((e.target as HTMLInputElement).value)}
								@keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Escape") {
                    props.onClose();
                  }
                }}
							/>
						</div>
					`
          : nothing
      }
			<div class="ge-dropdown__list">
				${
          filtered.length === 0
            ? html`<div class="ge-dropdown__empty">
							${props.emptyText ?? "No items"}
						</div>`
            : filtered.map(
                (item) => html`
								<button
									class="ge-dropdown__item ${item.checked ? "ge-dropdown__item--active" : ""}"
									@click=${() => props.onSelect(item.id)}
								>
									${
                    item.icon
                      ? html`<span class="ge-dropdown__item-icon"
												>${item.icon}</span
											>`
                      : nothing
                  }
									<span class="ge-dropdown__item-body">
										<span class="ge-dropdown__item-label"
											>${item.label}</span
										>
										${
                      item.description
                        ? html`<span
													class="ge-dropdown__item-desc"
													>${item.description}</span
												>`
                        : nothing
                    }
									</span>
									${
                    item.badge
                      ? html`<span class="ge-dropdown__item-badge"
												>${item.badge}</span
											>`
                      : nothing
                  }
									${
                    item.checked
                      ? html`
                          <span class="ge-dropdown__item-check">&#10003;</span>
                        `
                      : nothing
                  }
								</button>
							`,
              )
        }
			</div>
		</div>
	`;
}
