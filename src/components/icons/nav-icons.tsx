import type { SVGProps } from "react";

export type NavIconProps = SVGProps<SVGSVGElement>;

export function OrdersIcon(props: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M11.7363 5.12627H13.5512" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.43769 14.5367H6.80983" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.81418 14.5367H10.1863" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2416 14.5367H13.6138" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.43769 11.5636H6.80983" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.81418 11.5636H10.1863" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2416 11.5636H13.6138" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.89604 15.8341C2.97276 17.2063 4.01627 18.3106 5.34677 18.4106C8.51452 18.6489 11.4855 18.6489 14.6533 18.4106C15.9837 18.3106 17.0272 17.2063 17.104 15.8341C17.3242 11.8953 17.3242 8.10473 17.104 4.16593C17.0272 2.79372 15.9837 1.68939 14.6533 1.58935C11.4855 1.35117 8.51452 1.35117 5.34677 1.58935C4.01627 1.68939 2.97276 2.79372 2.89604 4.16593C2.6758 8.10473 2.6758 11.8953 2.89604 15.8341Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.2516 8.07948H2.74956" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function OfficeIcon(props: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g clipPath="url(#office-clip)">
        <path d="M2.73214 11.9821V15.6161C2.73214 17.0757 3.91539 18.2589 5.375 18.2589H14.625C16.0847 18.2589 17.2679 17.0757 17.2679 15.6161V11.9821" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11.9821 11.9821V18.2589" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.73214 13.9643H11.9821" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4.91759 9.55147C5.95668 9.55147 6.87925 9.07249 7.45879 8.33198C8.03834 9.07249 8.96089 9.55147 10 9.55147C11.0391 9.55147 11.9617 9.07249 12.5412 8.33198C13.1208 9.07249 14.0433 9.55147 15.0825 9.55147C16.8368 9.55147 18.2589 8.18618 18.2589 6.50202C18.2589 5.68883 17.6236 3.15779 15.0825 2.18196C11.1394 1.59677 8.91401 1.59146 4.91759 2.18196C2.37637 3.15779 1.74107 5.68883 1.74107 6.50202C1.74107 8.18618 3.16325 9.55147 4.91759 9.55147Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="office-clip"><rect width="20" height="20" fill="white" /></clipPath>
      </defs>
    </svg>
  );
}

export function InventoryIcon(props: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g clipPath="url(#inventory-clip)">
        <path d="M2.40711 6.07643C2.40711 6.07643 4.23504 2.08435 5.72079 1.95301C7.1385 1.82768 8.30968 1.74107 9.99988 1.74107C11.6747 1.74107 12.8399 1.8261 14.2403 1.94959C15.7156 2.07969 17.5907 6.0735 17.5907 6.0735" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.99985 5.04464V1.74146" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.21244 16.6864C2.31101 17.3263 2.83008 17.8196 3.46628 17.8695C5.556 18.0334 7.74502 18.2589 9.99998 18.2589C12.2549 18.2589 14.444 18.0334 16.5337 17.8695C17.1698 17.8196 17.689 17.3263 17.7874 16.6864C18.003 15.288 18.2589 13.151 18.2589 11.6518C18.2589 10.1526 18.003 8.01567 17.7874 6.61711C17.689 5.97726 17.1698 5.48402 16.5337 5.43414C14.444 5.27027 12.2549 5.04465 9.99998 5.04465C7.74502 5.04465 5.556 5.27027 3.46628 5.43414C2.83008 5.48402 2.31101 5.97726 2.21244 6.61711C1.99701 8.01567 1.74107 10.1526 1.74107 11.6518C1.74107 13.151 1.99701 15.288 2.21244 16.6864Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="inventory-clip"><rect width="20" height="20" fill="white" /></clipPath>
      </defs>
    </svg>
  );
}

export function ProductsIcon(props: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g clipPath="url(#products-clip)">
        <path d="M18.5891 6.44234C17.5336 6.31139 15.1964 6.0707 13.0146 6.07072C10.8327 6.0707 8.4956 6.31139 7.43993 6.44234" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.3047 5.41014C13.3047 3.73041 13.5545 1.84777 15.6307 1.59025L18.5893 1.41071" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.22554 11.8371C2.4079 11.8371 2.08146 14.4459 2.46636 16.6234C2.65095 17.6677 3.56744 18.4139 4.62495 18.4924C6.36352 18.6215 8.08715 18.6215 9.82571 18.4924C10.8832 18.4139 11.7997 17.6677 11.9844 16.6235C12.3694 14.4459 12.0432 11.8371 7.22554 11.8371Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1.41071 15.715C5.30664 15.3583 9.14408 15.3583 13.04 15.715" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.31387 8.91915C8.25626 8.05793 8.21467 7.20181 8.18901 6.35625C9.39705 6.22703 11.2562 6.07072 13.0146 6.07072C14.773 6.07072 16.6321 6.22703 17.8402 6.35625C17.7312 9.94633 17.3353 13.7269 16.6443 17.2791C16.539 17.8209 16.1012 18.2373 15.5528 18.3C15.301 18.3288 14.7885 18.3858 14.5381 18.406" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="products-clip"><rect width="20" height="20" fill="white" /></clipPath>
      </defs>
    </svg>
  );
}

export function RecipesIcon(props: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g clipPath="url(#recipes-clip)">
        <path d="M2.02533 13.3955C1.61386 14.9103 1.12486 18.259 4.66743 18.259H15.4325C12.8932 18.259 11.8259 15.6395 12.7828 13.3955C9.67641 13.0528 5.13171 13.0527 2.02533 13.3955Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.13668 5.92218H14.5354" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.13668 9.43219H14.5354" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.8359 18.2576H15.5172C16.9096 18.2576 18.0663 17.1776 18.13 15.7868C18.3237 11.5649 18.3003 7.36193 18.0601 3.13545C18.0236 2.49442 17.5271 1.97528 16.887 1.925C13.8431 1.6859 9.77185 1.67415 6.74052 1.92381C6.121 1.97484 5.6349 2.46801 5.5848 3.08761C5.32642 6.28337 5.35851 9.43655 5.68105 12.6429" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="recipes-clip"><rect width="20" height="20" fill="white" /></clipPath>
      </defs>
    </svg>
  );
}

export function PrepOrdersIcon(props: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M15.2058 13.7449C15.2058 13.7449 14.9955 15.1147 14.7209 16.4427C14.5188 17.421 13.7218 18.1479 12.7319 18.2822C9.718 18.6909 6.78466 18.6909 3.77075 18.2822C2.78088 18.1479 1.98388 17.421 1.78168 16.4427C1.63596 15.7377 1.50835 15.021 1.42069 14.5037C1.35305 14.1045 1.66195 13.7449 2.06679 13.7449H15.2058Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.2058 13.7457C15.2862 13.2986 15.3667 12.5498 15.5027 11.7042C15.6498 10.789 16.3312 10.0683 17.2154 9.78985L18.5889 9.35736" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.37296 10.5659C3.97197 9.75595 3.97197 8.95937 4.37296 8.14948" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.00238 10.5659C7.6014 9.75595 7.6014 8.95937 8.00238 8.14948" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.4266 10.5659C11.0256 9.75595 11.0256 8.95937 11.4266 8.14948" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PurchasingIcon(props: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g clipPath="url(#purchasing-clip)">
        <path d="M1.41071 1.41071H2.50046C3.72677 1.41071 4.792 2.25428 5.073 3.44797L5.89118 6.92355" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.5844 6.03404C18.3957 8.12465 17.8081 11.4093 17.3253 12.5417C17.1045 13.0598 16.6863 13.454 16.1391 13.5955C15.4553 13.7725 14.2694 13.9643 12.3414 13.9643C10.4135 13.9643 9.2276 13.7725 8.54377 13.5955C7.99658 13.454 7.58085 13.0579 7.37177 12.5349C6.81475 11.1415 5.77623 7.17774 5.375 4.71429H17.3185C18.0515 4.71429 18.6499 5.30717 18.5844 6.03404Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.18303 18.5893C8.9998 18.5893 9.66191 17.9271 9.66191 17.1105C9.66191 16.2937 8.9998 15.6315 8.18303 15.6315C7.36629 15.6315 6.70417 16.2937 6.70417 17.1105C6.70417 17.9271 7.36629 18.5893 8.18303 18.5893Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.442 18.5893C17.2587 18.5893 17.9208 17.9271 17.9208 17.1105C17.9208 16.2937 17.2587 15.6315 16.442 15.6315C15.6252 15.6315 14.9632 16.2937 14.9632 17.1105C14.9632 17.9271 15.6252 18.5893 16.442 18.5893Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.625 9.33881H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <defs>
        <clipPath id="purchasing-clip"><rect width="20" height="20" fill="white" /></clipPath>
      </defs>
    </svg>
  );
}

export function SettingsIcon(props: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M7.70026 12.0426C8.75693 13.2834 11.2436 13.2834 12.3003 12.0426C13.2735 10.8997 13.1997 8.6626 12.0282 7.68412C10.979 6.80769 9.02155 6.80769 7.97229 7.68412C6.80086 8.6626 6.72699 10.8997 7.70026 12.0426Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.38831 4.92121C2.78188 5.33425 2.3729 5.9835 2.28457 6.71188C2.00038 9.05567 2.00038 10.9443 2.28457 13.2881C2.3729 14.0165 2.78188 14.6657 3.38831 15.0788C5.27667 16.3649 7.24783 17.6322 9.27653 18.3558C9.74447 18.5227 10.2555 18.5227 10.7235 18.3558C12.7522 17.6322 14.7233 16.3649 16.6116 15.0788C17.2182 14.6657 17.6272 14.0165 17.7154 13.2881C17.9997 10.9443 17.9997 9.05567 17.7154 6.71188C17.6272 5.9835 17.2182 5.33425 16.6116 4.92121C14.7233 3.63509 12.7522 2.36783 10.7235 1.64417C10.2555 1.47725 9.74447 1.47725 9.27653 1.64417C7.24783 2.36783 5.27667 3.63509 3.38831 4.92121Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
