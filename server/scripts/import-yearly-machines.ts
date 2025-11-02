import { db } from "../db";
import { lines, subLines, machines, type Line, type SubLine, type Machine } from "@shared/schema";
import { eq } from "drizzle-orm";

type RawRecord = {
  lineName: string;
  subLineName: string;
  code: string;
  name: string;
  machineType: string;
  maintenanceFrequency: string;
  pmPlanYear: string;
  machineUptime: string;
};

const RAW_DATA_TEXT = `
Final Line|ECM|MF PM CS M09|CRIMP INLET (ECM)|Critical|Monthly|Monthly|1290 Min
Final Line|ECM|MF PM CS M10|CRIMP OUTLET (ECM)|Critical|Monthly|Monthly|1290 Min
Final Line|Inter Cooler|MF PM CS E10|CRIMP MACHINE INLET  ( I/C Cell )|Non Critical|Monthly|Monthly|1290 Min
Final Line|Inter Cooler|MF PM CS E12|CRIMP MACHINE OUTLET  ( I/C Cell )|Non Critical|Monthly|Monthly|1290 Min
Final Line|Gamma|MF PM CS G01|CRIMP INLET (GAMMA)|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Gamma|MF PM CS G02|CRIMP OUTLET (GAMMA)|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Mainifold|Mainifold|MF PM CS CD30|SIDE SUPPORT WAVE CRIMPING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|MG|MF PM CS MGMM05|CRIMPING MACHINE (MG RADIATOR)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS FT13|CRIMPING (AC LINE)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
WCAC|WCAC|MF PM CS WC07|WHEEL CRIMPING INLET (WCAC)|Critical|Half yearly|Jul-Jan|1290 Min
WCAC|WCAC|MF PM CS WC08|WHEEL CRIMPING OUTLET (WCAC)|Critical|Half yearly|Jul-Jan|1290 Min
Final Line|ECM|MF PM CS U22|CHANGE OVER TROLLY (CRIMP MACHINE)|Non Critical|Monthly|Monthly|1290 Min
Final Line|ECM|MF PM CS M11|DRY LEAK TEST & PRINTER (ECM)|Critical|Monthly|Monthly|1290 Min
Final Line|Inter Cooler|MF PM CS E11|DRY LEAK TEST & PRINTER ( I/C Cell )|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Gamma|MF PM CS G06|DRY LEAK TEST & PRINTER (GAMMA )|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Condeser|MF PM CS CD21|AIR LEAK TESTER-1|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|Condeser|MF PM CS CD33|AIR LEAK TESTER-2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|MG|MF PM CS MGMM09|LEAK TESTING (MG RADIATOR)|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
Final Line|MG|MF PM CS MGMM23|DRY LEAK TESTING (MG CAC)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Condeser|MF PM CS MGMM13|ILT AND ALT (MG CONDENSOR)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|FDM|F M PMC 23|LEAK TESTING,PRE-FILTER ASSY|Non Critical|Half yearly|Feb-Aug|1290 Min
Final Line|FDM|F M PMC 29|LEAK TESTING,FLANGE-TRANSFER LEG ASSY & SG ASSY WITH FDM,FDM SOLDRING|Non Critical|Half yearly|May-Nov|1290 Min
Final Line|FDM|F M PMC 70B|DRY LEAK & VACCUM CLEANING 0.8 L & 1.5 LPV.|Non Critical|Half yearly|Jun-Dec|1290 Min
Final Line|FDM|F M PMC 70A|LEAK TESTING & VACCUM CLEANING(DV5 AND DV6)|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF14|AIR LEAK TESTER ( U725/P703(GA,HA) )|Non Critical|Half yearly|Apr-Oct|1290 Min
WCAC|WCAC|MF PM CS WC03|CORE LEAK TESTING (WCAC)|Non Critical|Half yearly|Jul-Jan|1290 Min
WCAC|WCAC|MF PM CS WC06|DRY LEAK TESTING (WCAC)|Non Critical|Half yearly|Jul-Jan|1290 Min
Final Line|ECM|MF PM CS M14|TOC ASSY. & Dry LEAK TESTING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|ECM|MF PM CS E01|FAN & SHROUD TESTING MACHINE-1|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|ECM|MF PM CS E02|FAN SHROUD ASSEMBLY & FIXTURES -1|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|ECM|MF PM CS E06|RADIATOR SHROUD ASSEMBLY & FIXTURES -1|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|ECM|MF PM CS E07|FAN & SHROUD TESTING MACHINE-2|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|ECM|MF PM CS E08|FAN SHROUD ASSEMBLY & FIXTURES -2|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|ECM|MF PM CS E09|RADIATOR SHROUD ASSEMBLY & FIXTURES -2|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|ECM|MF PM CS E13|FAN BALANCING-1 (ECM-A)|Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|ECM|MF PM CS E14|FAN BALANCING-2 (ECM-A) SPD|Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|ECM|MF PM CS E16|FAN BALANCING-2 (ECM-B)|Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|ECM|MF PM CS M13|RADIATOR  CONVEYOR|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Gamma|MF PM CS G03|SWITCH ASSY-1 (GAMMA)|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Gamma|MF PM CS G04|PIPE ASSY-1 (GAMMA)|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Gamma|MF PM CS G05|BRACKET ASSY-1 (GAMMA)|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Gamma|MF PM CS G07|SWITCH ASSY-2 (GAMMA)|Critical|Quarterly|May-Aug-Nov-Feb|1290 Min
Final Line|Gamma|MF PM CS G08|PIPE ASSY-2 (GAMMA)|Critical|Quarterly|May-Aug-Nov-Feb|1290 Min
Final Line|Gamma|MF PM CS G09|BRACKET ASSY-2 (GAMMA)|Critical|Quarterly|May-Aug-Nov-Feb|1290 Min
Front Line|Press Shop|MF PM CS C01|HEADER PRESS-1|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Front Line|Press Shop|MF PM CS C43|HEADER PRESS-2|Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Press Shop|MF PM CS MGMM26|HEADER PRESS-3|Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Press Shop|MF PM CS CD01|HOLE MAKING PRESS|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Front Line|Press Shop|MF PM CS C45|EOT CRANE|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Tool & Die|Tool & Die|MF PM CS U18|CRANE DIE MAINT.|Non Critical|Half yearly|Jun-Dec|1290 Min
Front Line|Gamma|MF PM CS MGMM28|EOT CRANE (CORE BUILDERS)|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|IMM|MF PM CS MO01|MOULDING -1|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Front Line|IMM|MF PM CS MO02|MOULDING -2|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Front Line|IMM|MF PM CS MO03|SHROUD CUTTING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|IMM|MF PM CS MO04|SHROUD GAUGING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|IMM|MF PM CS MO05|TANK GAUGING & DRAIN COCK ASSY|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|IMM|MF PM CS MO06|P-TANK GAUGING ASSY|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|IMM|MF PM CS MO07|ULTRASONIC WELDING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Tool & Die|Tool & Die|MF PM CS TR01|DRILLING|Non Critical|Half yearly|Jan-Jul|1290 Min
Tool & Die|Tool & Die|MF PM CS TR02|LATHE|Non Critical|Half yearly|May-Nov|1290 Min
Tool & Die|Tool & Die|MF PM CS TR03|MILLING|Non Critical|Half yearly|May-Nov|1290 Min
Tool & Die|Tool & Die|MF PM CS TR05|SURFACE GRINDING|Non Critical|Half yearly|Apr-Oct|1290 Min
Tool & Die|Tool & Die|MF PM CS TR04|PEDESTAL GRINDING|Non Critical|Half yearly|Jun-Dec|1290 Min
Front Line|Gamma|MF PM CS C02|FIN MILL -1|Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Front Line|RAD|MF PM CS C12|FIN MILL -2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Gamma|MF PM CS C47|FIN MILL -3|Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|RAD|MF PM CS C16|FIN MILL- 4|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|RAD|MF PM CS C22|FIN MILL- 5 (MATRIX)|Critical|Monthly|Monthly|1290 Min
Front Line|Condeser|MF PM CS CD08|FIN MILL-6 MATRIX (COND)|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Gamma|MF PM CS C40|FIN MILL-7 (AUTO FIN INSERTION)|Critical|Monthly|Monthly|1290 Min
Front Line|RAD|MF PM CS C42|FIN MILL-8 (MATRIX)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|Condeser|MF PM CS CD26|FIN MILL-9 MATRIX (COND)|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Gamma|MF PM CS C48|FIN MILL-10 (AUTO FIN INSERTION)|Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Condeser|MF PM CS MGMM11|FIN MILL MATRIX-11 (MG CONDENSOR)|Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|MG|MF PM CS MGMM03|FIN MILL-12 MATRIX (MG RADIATOR)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|Condeser|MF PM CS CD36|FIN MILL-13 MATRIX (COND)|Critical|Quarterly|Apr-Jul-Oct-Jan|1290 Min
Front Line|Gamma|MF PM CS C44|CORE BUILDER-1 MATRIX GAMMA (CAC)|Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Gamma|MF PM CS C03|CORE BUILDER-2 MATRIX GAMMA (CAC)|Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|CAC|MF PM CS C04|CORE BUILDER-1 (CAC)|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|CAC|MF PM CS C14|CORE BUILDER-2 (CAC)|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|CAC|MF PM CS C38|CORE BUILDER (H79)-4 (CAC)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Front Line|RAD|MF PM CS C05|CORE BUILDER -1 (RAD)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Front Line|RAD|MF PM CS C17|CORE BUILDER-  2 (RAD)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|RAD|MF PM CS C46|CORE BUILDER-4 (RAD)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|RAD|MF PM CS C41|CORE BUILDER -5 MATRIX (RAD)|Critical|Monthly|Monthly|1290 Min
Front Line|RAD|MF PM CS C06|CORE BUILDER-6 MATRIX (RAD)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|RAD|MF PM CS C21|CORE BUILDER-7 MATRIX (RAD)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|MG|MF PM CS MGMM04|MATRIX CORE BUILDER-8 (MG RADIATOR)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|Condeser|MF PM CS CD09|CORE BUILDER-1 MATRIX (COND)|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Condeser|MF PM CS CD27|CORE BUILDER-2 MATRIX (COND)|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Condeser|MF PM CS MGMM12|MATRIX CORE BUILDER-3 (MG CONDENSOR)|Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Front Line|Condeser|MF PM CS CD37|CORE BUILDER-4 MATRIX (COND)|Critical|Quarterly|Apr-Jul-Oct-Jan|1290 Min
WCAC|WCAC|MF PM CS WC04|CORE BUILDER--1 (WCAC)|Critical|Half yearly|Jul-Jan|1290 Min
WCAC|WCAC|MF PM CS WC05|CORE BUILDER--2 (WCAC)|Critical|Half yearly|Jul-Jan|1290 Min
Front Line|Gamma|MF PM CS C09|FLUXER & FLUX DRIER-1|Critical|Monthly|Monthly|1290 Min
Front Line|RAD|MF PM CS C24|FLUXER & FLUX DRIER-2|Critical|Monthly|Monthly|1290 Min
Front Line|Condeser|MF PM CS C31|PAINT FLUXING|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF02|FLUXING MACHINE ( V710 )|Non Critical|Half yearly|Feb-Aug|1290 Min
Front Line|RAD|MF PM CS C32|TUBE DIPPING|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Front Line|Gamma|MF PM CS C10|FURNACE-1|Critical|Half yearly|Jun-Dec|1440 Min
Front Line|RAD|MF PM CS C25|FURNACE-2|Critical|Half yearly|Jun-Dec|1440 Min
EGR|EGR|F M PMC 54|S.S. FURNANCE|Non Critical|Half yearly|Mar-Sept|1440 Min
Front Line|Condeser|MF PM CS CD24|ULTRASONIC WASHING -1|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
FT|AC|MF PM CS FT06|ULTRASONIC WASHING-2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Mainifold|Mainifold|MF PM CS MGMM24|ULTRASONIC WASHING -3|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
Mainifold|Mainifold|MF PM CS MF12|ACIDIC WASHING  ( U725/P703(GA,HA) )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS CD02|BAFFLE CAULKING|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Mainifold|Mainifold|MF PM CS CD15|BAFFLE CAULKING (RX)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF03|BAFFLE CAULKING ( V710 )|Non Critical|Half yearly|Mar-Sep|1290 Min
Mainifold|Mainifold|MF PM CS MF16|BAFFLE CAULKING ( U725/P703(GA,HA) )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF22|BAFFLE CAULKING ( W601/MG )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF28|BAFFLE CAULKING ( MMA OHX )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF33|BAFFLE CAULKING ( MMA CDN )|Non Critical|Half yearly|Mar-Sep|1290 Min
Mainifold|Mainifold|MF PM CS MF38|BAFFLE CAULKING (YG8 )|Non Critical|Half yearly|Jul-Jan|1290 Min
Front Line|Condeser|MF PM CS CD29|BRACKET INSERTION-1|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Front Line|Condeser|MF PM CS CD45|BRACKET INSERTION -2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Mainifold|Mainifold|MF PM CS CD03|BRACKET RIVETING|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Mainifold|Mainifold|MF PM CS CD18|BRACKET RIVETING (RX)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MGMM20|BRACKET RIVETING (MG CAC)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF04|BRACKET RIVETING ( V710 )|Non Critical|Half yearly|Mar-Sep|1290 Min
Mainifold|Mainifold|MF PM CS MF17|BRACKET RIVETING ( U725/P703(GA,HA) )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF23|BRACKET RIVETING ( W601/MG )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF29|BRACKET RIVETING & FLANGE FLAIRING ( MMA OHX )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF34|BRACKET RIVETING & FLANGE FLAIRING ( MMA CDN )|Non Critical|Half yearly|Mar-Sep|1290 Min
Mainifold|Mainifold|MF PM CS MF39|BRACKET & FLANGE FLAIRING & RD PIPE & CONNECTOR PIPE FLAIRING (YG8)|Non Critical|Half yearly|Jul-Jan|1290 Min
Mainifold|Mainifold|MF PM CS CD04|END CAP|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF07|END CAP ASSEMBLY ( V710 )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF19|END CAP INSERTING & CONNECTOR FLAIRING ( U725/P703(GA,HA) )|Non Critical|Half yearly|May-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF25|END CAP INSERTING & CONNECTOR FLAIRING ( W601/MG )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF37|END CAP ASSEMBLY Machine ( MMA CDN )|Non Critical|Half yearly|May-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF40|END CAP INSERTING & PIPE FLAIRING (YG8)|Non Critical|Half yearly|Jul-Jan|1290 Min
Mainifold|Mainifold|MF PM CS CD05|CONNECTOR & FLANGE FLARING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Mainifold|Mainifold|MF PM CS CD17|CONNECTOR & FLANGE FLARING (RX)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF05|FLANGE FLAIRING ( V710 )|Non Critical|Half yearly|Mar-Sep|1290 Min
Mainifold|Mainifold|MF PM CS CD06|HEADER CAULKING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Mainifold|Mainifold|MF PM CS CD16|HEADER CAULKING (RX)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF06|HEADER CAULKING ( V710 )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF20|HEADER CAULKING ( U725/P703(GA,HA) )|Non Critical|Half yearly|May-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF26|HEADER CAULKING ( W601/MG )|Non Critical|Half yearly|May-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF30|HEADER CAULKING ( MMA OHX )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF35|HEADER CAULKING ( MMA CDN )|Non Critical|Half yearly|May-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF41|HEADER CAULKING (YG8)|Non Critical|Half yearly|Jul-Jan|1290 Min
Mainifold|Mainifold|MF PM CS CD07|BRACKET WELDING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Mainifold|Mainifold|MF PM CS CD36|PMC WELDING|Non Critical|Quarterly|Apr-Jul-Oct-Jan|1290 Min
Final Line|Condeser|MF PM CS CD23|AUTO TIG WELDING-1|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|Condeser|MF PM CS CD34|AUTO TIG WELDING-2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|MG|MF PM CS MGMM15|TIG WEDING-3 (MG CONDENSOR)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF13|WELDING MACHINE ( U725/P703(GA,HA) )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS CD10|SIDE SUPPORT|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF27|SIDE SUPPORT ASSEMBLY ( W601/MG )|Non Critical|Half yearly|May-Nov|1290 Min
Mainifold|Mainifold|MF PM CS CD31|CLAD SIM CUTTING|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|Condeser|MF PM CS CD11|DESICCANT BAG & CAP FILTER ASSY  & I.L.T-1|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|Condeser|MF PM CS CD22|DESICANT BAG & CAP FILTER ASSY.& I.L.T-2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|Condeser|MF PM CS MGMM14|DESICCANT BAG ASSEMBLY (MG CONDENSOR)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|Condeser|MF PM CS CD20|GAUGING & INSPECTION-1|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|Condeser|MF PM CS CD32|GAUGING & INSPECTION-2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|MG|MF PM CS MGMM10|GAUGING AND FINAL ASSEMBLY (MG RADIATOR)|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
Final Line|MG|MF PM CS MGMM18|FINAL INSPECTION AND GAUGING (MG CONDENSOR)|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
Final Line|MG|MF PM CS MGMM22|FINAL ASSEMBLY AND GAUGING (MG CAC)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS CD13|HELIUM LEAK DETECTOR-1 (AC LINE)|Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|Condeser|MF PM CS CD28|HELIUM LEAK DETECTOR-2 (MSIL)|Critical|Monthly|Monthly|1290 Min
Final Line|MG|MF PM CS MGMM16|HELIUM LEAK DETECTOR-3 (MG CONDENSOR)|Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
Final Line|Condeser|MF PM CS CD14|NITROGEN PURGING & FOAM PRESSING|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
FT|AC|MF PM CS FT02|END FORMING-1|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
FT|AC|MF PM CS FT04|END FORMING-2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
FT|AC|MF PM CS FT03|ROLL GROOVING-1|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
FT|AC|MF PM CS FT05|ROLL GROOVING-2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
FT|AC|MF PM CS FT07|BENDING MACHINE-1|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS FT08|BENDING MACHINE-2|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS FT09|BRAZING MACHINE (2 STATION)-1|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
FT|AC|MF PM CS FT10|BRAZING MACHINE (6 STATION)-2|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Mainifold|Mainifold|MF PM CS MF09|FLAME BRAZING-1 ( U725/P703(GA,HA)MG ,W601 )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF10|FLAME BRAZING-2 ( U725/P703(GA,HA)MG, W601 )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF11|FLAME BRAZING-3 ( U725/P703(GA,HA) )|Non Critical|Half yearly|Apr-Oct|1290 Min
FT|AC|MF PM CS FT01|TUBE CUTTING|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS FT11|PIERCING MACHINE|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
FT|AC|MF PM CS FT12|SEALANT APPLICATION|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
FT|AC|MF PM CS FT14|CHARGE VALVE ASSEMBLY|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS FT15|CLAMP ASSEMBLY|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS FT16|PRESSURE SWITCH ASSEMBLY|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
FT|AC|MF PM CS FT17|WLT- AC LINE|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS FT18|HOSE CUTTING|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
FT|AC|MF PM CS FT19|SAW CUTTING MACHINE|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
FT|AC|MF PM CS FT20|BLOCK TESTING|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
FT|AC|MF PM CS FT21|DEBURRINGD MACHINE|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
FT|AC|MF PM CS FT22|SEALANT DRY OVEN|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
FT|AC|MF PM CS FT23|DRY OVEN|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
WCAC|WCAC|F M PMC 54|DRY OFF OVEN.|Non Critical|Quarterly|Mar-Jun-Sep-Dec|1290 Min
Final Line|MG|MF PM CS MGMM06|TOC ASSEMBLY (MG RADIATOR)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|MG|MF PM CS MGMM07|SKEEWNESS CHECKING (MG RADIATOR)|Non Critical|Quarterly|Feb-May-Aug-Nov|1290 Min
Final Line|MG|MF PM CS MGMM08|THERMOSTATE ASSEMBLY (MG RADIATOR)|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
Final Line|MG|MF PM CS MGMM17|CONDENSOR SEAL ASSEMBLY (MG CONDENSOR)|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
Final Line|MG|MF PM CS MGMM21|DEFLECTOR ASSEMBLY (MG CAC)|Non Critical|Quarterly|Jan-Apr-Jul-Oct|1290 Min
Final Line|MG|MF PM CS MGMM27|TUBE PIERCING MACHINE|Non Critical|Quarterly|Mar-Jun-Sept-Dec|1290 Min
FDM|FDM|F M PMC 20|HOT PUNCHING|Non Critical|Half yearly|May-Nov|1290 Min
FDM|FDM|F M PMC 11|SG-2 ASSY & CARD ASSY|Non Critical|Half yearly|May-Nov|1290 Min
FDM|FDM|FM PMC 018|PUSH PUL TESTER|Non Critical|Half yearly|May-Nov|1290 Min
FDM|FDM|F M PMC 21|HOSE ASSEMBLY- I|Non Critical|Half yearly|Mar-Sept|1290 Min
FDM|FDM|F M PMC 22|HOSE ASSEMBLY - II|Non Critical|Half yearly|Mar-Sept|1290 Min
FDM|FDM|F M PMC 24|TMBS ASLY,JET PUMP CHAMBER COVER ASSY|Non Critical|Half yearly|Feb-Aug|1290 Min
FDM|FDM|F M PMC 25|RESERVOIR BLOCKAGE TEST ,RELIEF VALVE ASSY,UMBRELLA VALVE ASSY,NOZZLE ASSY & TESTING|Non Critical|Quarterly|Jan-Apr-July-Oct|1290 Min
FDM|FDM|F M PMC 26|FLOW TESTING,COVER -RESERVOIR SG FDM ASSY,FDM SOLDERING|Non Critical|Half yearly|May-Nov|1290 Min
FDM|FDM|F M PMC 27|END OF LINE TESTER (EOL)|Non Critical|Quarterly|Jan-Apr-July-Oct|1290 Min
FDM|FDM|F M PMC 28|HOSE  ASSEMBLY|Non Critical|Half yearly|May-Nov|1290 Min
FDM|FDM|F M PMC 30|END OF LINE TESTER (EOL)|Non Critical|Quarterly|Jan-Apr-July-Oct|1290 Min
FDM|FDM|F M PMC 10,20|2.2  & 1.5 LCV INSERT CAP & COOLANT  INLET TUBE &  SHALL ASSY.|Non Critical|Half yearly|Apr-Oct|1290 Min
FDM|FDM|F M PMC 52|CORE & SHALL  ASSY. 0.8 L & 1.5 LPV|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF01|WELDMENT ASSEMBLY( V710 )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF15|WELDMENT ASSEMBLY ( U725/P703(GA,HA) )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF32|WELDMENT ASSEMBLY ( U725/P703(GA,HA) )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF18|PIPE FLAIRING ( U725/P703(GA,HA) )|Non Critical|Half yearly|May-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF24|PIPE FLAIRING ( W601/MG )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF08|LASER MARKING ( V710 )|Non Critical|Half yearly|Apr-Oct|1290 Min
Mainifold|Mainifold|MF PM CS MF31|LASER MARKING ( MMA OHX )|Non Critical|Half yearly|Feb-Aug|1290 Min
Mainifold|Mainifold|MF PM CS MF36|LASER MARKING ( MMA CDN )|Non Critical|Half yearly|May-Nov|1290 Min
Mainifold|Mainifold|MF PM CS MF21|FINAL INSPECTION & LASER MARKING ( U725/P703(GA,HA) )|Non Critical|Half yearly|May-Nov|1290 Min
WCAC|WCAC|MF PM CS WC01|COOLENT SPOUT FLAIRING  (WCAC)|Critical|Half yearly|Jul-Jan|1290 Min
WCAC|WCAC|MF PM CS WC02|RUNNER SPOUT FLAIRING D.GAS (WCAC)|Critical|Half yearly|Jul-Jan|1290 Min
`;

const RAW_DATA: RawRecord[] = RAW_DATA_TEXT.trim().split(/\r?\n/).map((line, index) => {
  const parts = line.split("|");
  if (parts.length !== 8) {
    throw new Error(`Invalid data row at line ${index + 1}: "${line}"`);
  }

  const [lineName, subLineName, code, name, machineType, maintenanceFrequency, pmPlanYear, machineUptime] = parts;

  return {
    lineName: lineName.trim(),
    subLineName: subLineName.trim(),
    code: code.trim(),
    name: name.trim(),
    machineType: machineType.trim(),
    maintenanceFrequency: maintenanceFrequency.trim(),
    pmPlanYear: pmPlanYear.trim(),
    machineUptime: machineUptime.trim(),
  };
});

const FREQUENCY_LOOKUP = new Map<string, string>([
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["half yearly", "Half Yearly"],
  ["half-yearly", "Half Yearly"],
  ["half  yearly", "Half Yearly"],
]);

const normalizeFrequency = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return FREQUENCY_LOOKUP.get(normalized) ?? value.trim();
};

const normalizePmPlanYear = (value: string): string => {
  return value.replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").trim();
};

const parseUptime = (value: string): number | null => {
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : null;
};

async function ensureLine(
  caches: Map<string, Line>,
  name: string,
): Promise<Line> {
  const key = name.trim().toLowerCase();
  const existing = caches.get(key);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(lines)
    .values({ name: name.trim(), description: `${name.trim()} production line` })
    .returning();

  caches.set(key, created);
  console.log(`Created line "${name.trim()}"`);
  return created;
}

async function ensureSubLine(
  cache: Map<string, SubLine>,
  lineId: string,
  name: string,
): Promise<SubLine | null> {
  const trimmed = name.trim();
  if (!trimmed) {
    return null;
  }
  const key = `${lineId}::${trimmed.toLowerCase()}`;
  const existing = cache.get(key);
  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(subLines)
    .values({ name: trimmed, lineId })
    .returning();

  cache.set(key, created);
  console.log(`Created sub line "${trimmed}" for line ${lineId}`);
  return created;
}

async function upsertMachine(
  cache: Map<string, Machine>,
  record: RawRecord,
  line: Line,
  subLine: SubLine | null,
) {
  const codeKey = record.code.trim().toLowerCase();
  const existing = cache.get(codeKey);
  const normalizedFrequency = normalizeFrequency(record.maintenanceFrequency);
  const normalizedPmPlan = normalizePmPlanYear(record.pmPlanYear);
  const uptime = parseUptime(record.machineUptime);

  if (existing) {
    await db
      .update(machines)
      .set({
        name: record.name.trim(),
        type: record.machineType.trim(),
        maintenanceFrequency: normalizedFrequency,
        pmPlanYear: normalizedPmPlan,
        uptime: uptime ?? existing.uptime ?? null,
        lineId: line.id,
        subLineId: subLine?.id ?? null,
      })
      .where(eq(machines.id, existing.id));

    cache.set(codeKey, {
      ...existing,
      name: record.name.trim(),
      type: record.machineType.trim(),
      maintenanceFrequency: normalizedFrequency,
      pmPlanYear: normalizedPmPlan,
      uptime: uptime ?? existing.uptime ?? null,
      lineId: line.id,
      subLineId: subLine?.id ?? null,
    });

    return { inserted: false };
  }

  const [created] = await db
    .insert(machines)
    .values({
      name: record.name.trim(),
      code: record.code.trim(),
      type: record.machineType.trim(),
      maintenanceFrequency: normalizedFrequency,
      pmPlanYear: normalizedPmPlan,
      uptime: uptime ?? null,
      lineId: line.id,
      subLineId: subLine?.id ?? null,
    })
    .returning();

  cache.set(codeKey, created);
  console.log(`Created machine "${record.name.trim()}" (${record.code.trim()})`);
  return { inserted: true };
}

async function main() {
  console.log("Importing yearly planner machine master data...");

  const existingLines = await db.select().from(lines);
  const existingSubLines = await db.select().from(subLines);
  const existingMachines = await db.select().from(machines);

  const lineCache = new Map<string, Line>();
  for (const line of existingLines) {
    lineCache.set(line.name.trim().toLowerCase(), line);
  }

  const subLineCache = new Map<string, SubLine>();
  for (const subLine of existingSubLines) {
    subLineCache.set(
      `${subLine.lineId ?? ""}::${subLine.name.trim().toLowerCase()}`,
      subLine,
    );
  }

  const machineCache = new Map<string, Machine>();
  for (const machine of existingMachines) {
    if (!machine.code) {
      continue;
    }
    machineCache.set(machine.code.trim().toLowerCase(), machine);
  }

  let insertedCount = 0;
  let updatedCount = 0;

  for (const record of RAW_DATA) {
    const line = await ensureLine(lineCache, record.lineName);
    const subLine = await ensureSubLine(subLineCache, line.id, record.subLineName);

    const result = await upsertMachine(machineCache, record, line, subLine);
    if (result.inserted) {
      insertedCount += 1;
    } else {
      updatedCount += 1;
    }
  }

  console.log(
    `Yearly planner master data import complete. Inserted ${insertedCount} machines, updated ${updatedCount}.`,
  );
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to import yearly planner data:", error);
    process.exit(1);
  });

