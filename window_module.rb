require 'sketchup.rb'
require 'json'

# FONTOS BEÁLLÍTÁSOK:
# - Kétszárnyú ablakok egymásra takarása: 26mm (fix érték)
#   Ez az érték a collect_window_components függvényben található a 'nyilo_egymastakaro = 26' változóban
#   Ezt az értéket használjuk mind a szimmetrikus, mind az aszimmetrikus kétszárnyú ablakoknál

module WindowGenerator
  module WindowModule
    
    # Panel méretek számítása
    # Ez a metódus a canvas helyett a Ruby oldalon végzi a panel méretek kiszámítását
    def self.calculate_panel_dimensions(params)
      begin
        puts "Panel méretek számítása Ruby oldalon..."
        
        # Paraméterek feldolgozása
        if params.is_a?(String)
          params = JSON.parse(params)
        end
        
        # Alapadatok kinyerése
        window_type = params["window_type"] || "Egyszárnyú"
        frame_width = params["frame_width"].to_f
        frame_height = params["frame_height"].to_f
        frame_wood_width = params["frame_wood_width"].to_f
        
        # Nyíló levonások
        sash_width_deduction = params["sash_width_deduction"].to_f
        sash_height_deduction = params["sash_height_deduction"].to_f
        sash_double_deduction = params["sash_double_deduction"].to_f
        
        # Fríz paraméterek
        frieze_width = params["window_frieze_width"].to_f if params["window_frieze_width"]
        frieze_width ||= params["sash_wood_width"].to_f if params["sash_wood_width"]
        frieze_width ||= 60.0
        
        # Osztók és paramétereik
        horizontal_divisions = params["horizontal_divisions"].to_i
        vertical_divisions = params["vertical_divisions"].to_i
        
        division_wood_width = params["window_division_wood_width"].to_f if params["window_division_wood_width"]
        division_wood_width ||= frieze_width
        
        vertical_division_width = params["window_vertical_division_width"].to_f if params["window_vertical_division_width"]
        vertical_division_width ||= 40.0
        
        # Aszimmetrikus beállítások
        is_asymmetric = params["window_is_asymmetric"] == true || params["window_is_asymmetric"] == "true"
        main_wing_ratio = params["window_main_wing_ratio"].to_f if params["window_main_wing_ratio"]
        main_wing_ratio ||= 60.0 # Alapértelmezett 60%
        
        # Panel pozíciók és méretek számítása
        panel_dimensions = {}
        
        # Nyíló belméret számítása
        sash_width = frame_width - (2 * frame_wood_width) - sash_width_deduction
        sash_height = frame_height - (2 * frame_wood_width) - sash_height_deduction
        
        # Szárny szélesség számítása a window_type alapján
        if window_type == "Kétszárnyú" || window_type == "Tokosztós"
          if is_asymmetric
            # Aszimmetrikus kétszárnyú
            main_sash_width = (sash_width * (main_wing_ratio / 100.0))
            second_sash_width = sash_width - main_sash_width - sash_double_deduction
            wing_widths = [main_sash_width, second_sash_width]
          else
            # Szimmetrikus kétszárnyú/tokosztós
            wing_width = (sash_width - sash_double_deduction) / 2.0
            wing_widths = [wing_width, wing_width]
          end
          
          # Kétszárnyú ablakok paneljeinek számítása
          wing_widths.each_with_index do |wing_width, wing_idx|
            wing_name = wing_idx == 0 ? "left" : "right"
            
            # Vízszintes szekciók számítása
            row_heights = []
            if horizontal_divisions > 0
              section_height = (sash_height - ((horizontal_divisions + 1) * frieze_width) - 
                              (horizontal_divisions - 1) * division_wood_width) / horizontal_divisions
              horizontal_divisions.times do |i|
                row_heights << section_height
              end
            else
              # Ha nincs vízszintes osztó, egyetlen szekció
              row_heights << sash_height - (2 * frieze_width)
            end
            
            # Függőleges szekciók számítása
            col_widths = []
            if vertical_divisions > 0
              section_width = (wing_width - ((vertical_divisions + 1) * frieze_width) - 
                             (vertical_divisions - 1) * vertical_division_width) / vertical_divisions
              vertical_divisions.times do |i|
                col_widths << section_width
              end
            else
              # Ha nincs függőleges osztó, egyetlen szekció
              col_widths << wing_width - (2 * frieze_width)
            end
            
            # Panel mátrix létrehozása szárnyak szerint
            row_heights.each_with_index do |height, row|
              col_widths.each_with_index do |width, col|
                panel_id = "#{wing_name}_#{row}_#{col}"
                
                # Pozíció számítás
                start_x = frame_wood_width + (wing_idx == 0 ? 0 : wing_widths[0] + sash_double_deduction) + frieze_width
                if col > 0
                  # Hozzáadjuk az előző oszlopok szélességét és a köztes osztókat
                  start_x += col_widths.take(col).sum + (col * (frieze_width + vertical_division_width))
                end
                
                start_y = frame_wood_width + frieze_width
                if row > 0
                  # Hozzáadjuk az előző sorok magasságát és a köztes osztókat
                  start_y += row_heights.take(row).sum + (row * (frieze_width + division_wood_width))
                end
                
                panel_dimensions[panel_id] = {
                  width: width,
                  height: height,
                  left: start_x,
                  top: start_y,
                  row: row,
                  col: col,
                  wing: wing_name
                }
              end
            end
          end
        else
          # Egyszárnyú ablak panel számítása
          # Vízszintes szekciók számítása
          row_heights = []
          if horizontal_divisions > 0
            section_height = (sash_height - ((horizontal_divisions + 1) * frieze_width) - 
                           (horizontal_divisions - 1) * division_wood_width) / horizontal_divisions
            horizontal_divisions.times do |i|
              row_heights << section_height
            end
          else
            # Ha nincs vízszintes osztó, egyetlen szekció
            row_heights << sash_height - (2 * frieze_width)
          end
          
          # Függőleges szekciók számítása
          col_widths = []
          if vertical_divisions > 0
            section_width = (sash_width - ((vertical_divisions + 1) * frieze_width) - 
                           (vertical_divisions - 1) * vertical_division_width) / vertical_divisions
            vertical_divisions.times do |i|
              col_widths << section_width
            end
          else
            # Ha nincs függőleges osztó, egyetlen szekció
            col_widths << sash_width - (2 * frieze_width)
          end
          
          # Panel mátrix létrehozása
          row_heights.each_with_index do |height, row|
            col_widths.each_with_index do |width, col|
              panel_id = "#{row}_#{col}"
              
              # Pozíció számítás
              start_x = frame_wood_width + frieze_width
              if col > 0
                # Hozzáadjuk az előző oszlopok szélességét és a köztes osztókat
                start_x += col_widths.take(col).sum + (col * (frieze_width + vertical_division_width))
              end
              
              start_y = frame_wood_width + frieze_width
              if row > 0
                # Hozzáadjuk az előző sorok magasságát és a köztes osztókat
                start_y += row_heights.take(row).sum + (row * (frieze_width + division_wood_width))
              end
              
              panel_dimensions[panel_id] = {
                width: width,
                height: height,
                left: start_x,
                top: start_y,
                row: row,
                col: col
              }
            end
          end
        end
        
        puts "Panel méretek kiszámítva: #{panel_dimensions.keys.count} panel"
        return panel_dimensions
        
      rescue => e
        puts "Hiba a panel méretek számítása közben: #{e.message}"
        puts e.backtrace
        return {}
      end
    end
    
    # API metódus panel méretek lekéréséhez
    def self.get_panel_dimensions(params_json)
      params = JSON.parse(params_json)
      dimensions = calculate_panel_dimensions(params)
      return dimensions.to_json
    end
    
    # Panel méretek számítása a Ruby oldalon
    def self.calculate_panel_dimensions(params)
      begin
        puts "\n[PANEL MÉRET SZÁMÍTÁS] === PANEL MÉRET SZÁMÍTÁS KEZDETE === Függvény: calculate_panel_dimensions ===\n"
        
        # Paraméterek feldolgozása
        if params.is_a?(String)
          params = JSON.parse(params)
        end
        
        # Alapadatok kinyerése
        window_type = params['window_type'] || 'Egyszárnyú'
        frame_width = params['frame_width'].to_f
        frame_height = params['frame_height'].to_f
        frame_wood_width = params['frame_wood_width'].to_f
        
        # Nyíló levonások
        sash_width_deduction = params['sash_width_deduction'].to_f
        sash_height_deduction = params['sash_height_deduction'].to_f
        sash_double_deduction = params['sash_double_deduction'].to_f
        
        # Fríz paraméterek
        frieze_width = params['window_frieze_width'].to_f if params['window_frieze_width']
        frieze_width ||= params['sash_wood_width'].to_f if params['sash_wood_width']
        frieze_width ||= 60.0
        
        # Osztók és paramétereik
        horizontal_divisions = params['horizontal_divisions'].to_i
        vertical_divisions = params['vertical_divisions'].to_i
        
        division_wood_width = params['window_division_wood_width'].to_f if params['window_division_wood_width']
        division_wood_width ||= frieze_width
        
        vertical_division_width = params['window_vertical_division_width'].to_f if params['window_vertical_division_width']
        vertical_division_width ||= 40.0
        
        # Aszimmetrikus beállítások
        is_asymmetric = params['window_is_asymmetric'] == true || params['window_is_asymmetric'] == 'true'
        main_wing_ratio = params['window_main_wing_ratio'].to_f if params['window_main_wing_ratio']
        main_wing_ratio ||= 60.0 # Alapértelmezett 60%
        
        # Panel adatok kinyerése
        panel_data = params['window_panels'] || []
        
        # Számoljuk ki a nyíló belméretét
        sash_outer_width = frame_width - sash_width_deduction
        sash_outer_height = frame_height - sash_height_deduction
        
        # Nyíló belméret (a fríz levonása után)
        sash_inner_width = sash_outer_width - (2 * frieze_width)
        sash_inner_height = sash_outer_height - (2 * frieze_width)
        
        # Definiáljuk a sash_width és sash_height változókat is, amelyeket később használunk
        sash_width = sash_outer_width
        sash_height = sash_outer_height
        
        puts "Ablak tok méret: #{frame_width}mm x #{frame_height}mm"
        puts "Nyíló méret: #{sash_outer_width}mm x #{sash_outer_height}mm"
        puts "Nyíló belméret: #{sash_inner_width}mm x #{sash_inner_height}mm"
        
        # Osztók pozícióinak kiszámítása
        horizontal_positions = []
        vertical_positions = []
        
        # Manuális pozíciók kezelése
        use_manual_distances = false
        if params['manualHorizontalPositions'] || params['manualVerticalPositions']
          use_manual_distances = true
          
          if params['manualHorizontalPositions']
            manual_horizontal = params['manualHorizontalPositions']
            manual_horizontal.each do |pos|
              horizontal_positions << pos.to_f
            end
          end
          
          if params['manualVerticalPositions']
            manual_vertical = params['manualVerticalPositions']
            manual_vertical.each do |pos|
              vertical_positions << pos.to_f
            end
          end
        else
          # Automatikus osztó pozíciók számítása
          if horizontal_divisions > 0
            segment_height = sash_height / (horizontal_divisions + 1)
            (1..horizontal_divisions).each do |i|
              horizontal_positions << (segment_height * i)
            end
          end
          
          if vertical_divisions > 0
            if window_type == 'Kétszárnyú' && !is_asymmetric
              # Szimmetrikus kétszárnyú ablak
              half_width = sash_width / 2
              segment_width = half_width / (vertical_divisions + 1)
              
              # Bal szárny osztói
              (1..vertical_divisions).each do |i|
                vertical_positions << (segment_width * i)
              end
              
              # Középső osztó (a két szárny között)
              vertical_positions << half_width
              
              # Jobb szárny osztói
              (1..vertical_divisions).each do |i|
                vertical_positions << (half_width + (segment_width * i))
              end
            elsif window_type == 'Kétszárnyú' && is_asymmetric
              # Aszimmetrikus kétszárnyú ablak
              main_width = (sash_width * main_wing_ratio) / 100.0
              second_width = sash_width - main_width
              
              # Fő szárny osztói
              if vertical_divisions > 0
                segment_width = main_width / (vertical_divisions + 1)
                (1..vertical_divisions).each do |i|
                  vertical_positions << (segment_width * i)
                end
              end
              
              # Középső osztó (a két szárny között)
              vertical_positions << main_width
              
              # Második szárny osztói
              if vertical_divisions > 0
                segment_width = second_width / (vertical_divisions + 1)
                (1..vertical_divisions).each do |i|
                  vertical_positions << (main_width + (segment_width * i))
                end
              end
            else
              # Egyszárnyú ablak
              segment_width = sash_width / (vertical_divisions + 1)
              (1..vertical_divisions).each do |i|
                vertical_positions << (segment_width * i)
              end
            end
          end
        end
        
        # Panel méretek kiszámítása
        panel_dimensions = {}
        
        # Szegmensek meghatározása
        row_segments = []
        col_segments = []
        
        # Vízszintes szegmensek
        if horizontal_positions.empty?
          # Ha nincsenek vízszintes osztók, akkor egy szegmens van
          row_segments << { top: 0, bottom: sash_outer_height }
        else
          # Rendezzük a pozíciókat
          horizontal_positions.sort!
          
          # Első szegmens (felső széltől az első osztóig)
          row_segments << { top: 0, bottom: horizontal_positions[0] }
          
          # Középső szegmensek
          (0...(horizontal_positions.length - 1)).each do |i|
            row_segments << { 
              top: horizontal_positions[i], 
              bottom: horizontal_positions[i + 1] 
            }
          end
          
          # Utolsó szegmens (utolsó osztótól az alsó szélig)
          row_segments << { 
            top: horizontal_positions.last, 
            bottom: sash_outer_height 
          }
        end
        
        # Függőleges szegmensek
        if vertical_positions.empty?
          # Ha nincsenek függőleges osztók, akkor egy szegmens van
          col_segments << { left: 0, right: sash_outer_width }
        else
          # Rendezzük a pozíciókat
          vertical_positions.sort!
          
          # Első szegmens (bal széltől az első osztóig)
          col_segments << { left: 0, right: vertical_positions[0] }
          
          # Középső szegmensek
          (0...(vertical_positions.length - 1)).each do |i|
            col_segments << { 
              left: vertical_positions[i], 
              right: vertical_positions[i + 1] 
            }
          end
          
          # Utolsó szegmens (utolsó osztótól a jobb szélig)
          col_segments << { 
            left: vertical_positions.last, 
            right: sash_outer_width 
          }
        end
        
        # Panel adatok feldolgozása
        panel_dimensions = {}
        
        # Minden panel adathoz kiszámítjuk a méreteket
        panel_data.each do |panel|
          panel_id = panel['id']
          row = panel['row'].to_i
          col = panel['col'].to_i
          wing = panel['wing'] # Kétszárnyú ablakokon
          panel_type = panel['type'] || 'glass'
          
          # Alapméretek számítása
          
          # Számoljuk ki a panelek számát a panel adatok alapján
          panels_in_window = panel_data.length
          
          # Szárnyankénti panelek száma kétszárnyú ablaknál
          panels_per_wing = window_type == 'Kétszárnyú' ? panels_in_window / 2 : panels_in_window
          
          # Függőleges osztók száma = panelek száma - 1 (szárnyanként)
          actual_vertical_divisions = panels_per_wing - 1
          
          puts "[PANEL MÉRET SZÁMÍTÁS] Összes panel száma: #{panels_in_window}, Szárnyankénti panelek: #{panels_per_wing}, Függőleges osztók: #{actual_vertical_divisions}"
          
          # Vízszintes osztók nélküli ablak
          if horizontal_divisions == 0
            # Panel magasság számítása (vízszintes osztók nélkül)
            panel_height = sash_inner_height
            puts "[PANEL MÉRET SZÁMÍTÁS] Vízszintes osztók nélküli ablak, panel magasság: #{panel_height}mm"
            
            # Függőleges osztók szélessége
            vertical_division_width = params['division_wood_width'].to_f if params['division_wood_width']
            vertical_division_width ||= 60.0 # Alapértelmezett érték a JavaScript oldal alapján
            
            if window_type == 'Kétszárnyú'
              # Kétszárnyú ablaknál figyelembe vesszük a szárnyak átfedését (26mm fix érték)
              # Teljes nyíló szélesség = Tok külméret - Nyíló szélesség levonás + 26mm
              total_sash_width = frame_width - sash_width_deduction + 26.0
              # Egy szárny szélessége = Teljes nyíló szélesség / 2
              wing_width = total_sash_width / 2.0
              
              # Szárnyon belüli nyíló belméret
              wing_inner_width = wing_width - (2 * frieze_width)
              
              # Osztók össz-szélessége szárnyanként
              total_division_width = actual_vertical_divisions * vertical_division_width
              
              # Panel szélesség = (Szárny belméret - Osztók össz-szélessége) / Panelek száma szárnyanként
              panel_width = (wing_inner_width - total_division_width) / panels_per_wing
              
              puts "[PANEL MÉRET SZÁMÍTÁS] Kétszárnyú ablak számítás: Tok külméret: #{frame_width}mm, Teljes nyíló szélesség: #{total_sash_width}mm"
              puts "[PANEL MÉRET SZÁMÍTÁS] Szárny szélesség: #{wing_width}mm, Szárny belméret: #{wing_inner_width}mm"
              puts "[PANEL MÉRET SZÁMÍTÁS] Osztók össz-szélessége: #{total_division_width}mm, Panel szélesség: #{panel_width}mm"
            else
              # Egyszárnyú ablaknál
              # Osztók össz-szélessége
              total_division_width = actual_vertical_divisions * vertical_division_width
              
              # Panel szélesség = (Nyíló belméret - Osztók össz-szélessége) / Panelek száma
              panel_width = (sash_inner_width - total_division_width) / panels_per_wing
              
              puts "[PANEL MÉRET SZÁMÍTÁS] Egyszárnyú ablak számítás: Nyíló belméret: #{sash_inner_width}mm"
              puts "[PANEL MÉRET SZÁMÍTÁS] Osztók össz-szélessége: #{total_division_width}mm, Panel száma: #{panels_per_wing}, Panel szélesség: #{panel_width}mm"
            end
            
          else
            # Osztókkal rendelkező ablakok esetén a régi logika marad
            if window_type == 'Kétszárnyú'
              # Kétszárnyú ablak esetén
              if is_asymmetric
                # Aszimmetrikus kétszárnyú
                main_width = (sash_outer_width * main_wing_ratio) / 100.0
                second_width = sash_outer_width - main_width - sash_double_deduction
                
                # Panel szélesség a szárny alapján
                if col < 2 # Bal szárny
                  panel_width = main_width / 2.0
                else # Jobb szárny
                  panel_width = second_width / 2.0
                end
              else
                # Szimmetrikus kétszárnyú
                # A nyíló szélessége (levonások után)
                wing_width = sash_outer_width / 2.0
                # A panel szélessége a fríz levonása után
                panel_width = wing_width - (2 * frieze_width)
              end
              
              # Magasság számítása a sorok alapján
              if horizontal_divisions > 0
                panel_height = sash_outer_height / (horizontal_divisions + 1)
              else
                # A panel magassága a fríz levonása után
                panel_height = sash_inner_height
              end
            else
              # Egyszárnyú ablak esetén
              if vertical_divisions > 0
                panel_width = sash_outer_width / (vertical_divisions + 1)
              else
                # A panel szélessége a fríz levonása után
                panel_width = sash_inner_width
              end
              
              if horizontal_divisions > 0
                panel_height = sash_outer_height / (horizontal_divisions + 1)
              else
                # A panel magassága a fríz levonása után
                panel_height = sash_inner_height
              end
            end
          end
          
          # A fríz már le van vonva a panel méretből a korábbi számításokban
          # Nincs szükség további levonásra
          
          # Túlnúás (overlap) figyelembe vétele
          overlap = panel['overlap'].to_f if panel['overlap']
          overlap ||= 0
          
          # Ha van túlnúás, hozzáadjuk a panel méreteihez
          panel_width += (2 * overlap) if overlap > 0
          panel_height += (2 * overlap) if overlap > 0
          
          # Biztosítjuk, hogy a méretek pozitívak
          panel_width = panel_width > 0 ? panel_width : 10
          panel_height = panel_height > 0 ? panel_height : 10
          
          # Panel adatok tárolása
          panel_dimensions[panel_id] = {
            width: panel_width,
            height: panel_height,
            row: row,
            col: col,
            wing: wing,
            type: panel_type,
            overlap: overlap
          }
          
          puts "Panel #{panel_id} mérete: #{panel_width}mm x #{panel_height}mm, típusa: #{panel_type}"
        end
        
        puts "[PANEL MÉRET SZÁMÍTÁS] Kiszámított panel méretek: #{panel_dimensions.length} panel"
        return panel_dimensions
      rescue => e
        puts "Hiba a panel méretek számítása közben: #{e.message}"
        puts e.backtrace.join("\n")
        return {}
      end
    end

    # Ablak komponensek gyűjtése
    def self.generate_components(action_context, params)
      begin
        puts "=========== ABLAK GENERÁTOR MODUL ==========="
        puts "Kapott paraméterek: #{params}"
        params = JSON.parse(params)
        puts "Feldolgozott paraméterek: #{params.inspect}"
        
        # Darabszám kiolvasása
        quantity = params["window_count"].to_i
        
        # Ellenőrizzük, hogy a darabszám érvényes-e
        if quantity < 1
          quantity = 1 # Alapértelmezett 1 darab
        end
        
        puts "Ablak darabszám: #{quantity}"
        
        # Panel méretek kiszámítása a Ruby oldalon
        panel_dimensions = calculate_panel_dimensions(params)
        
        # A panel adatok frissítése a kiszámított méretekkel
        if params["window_panels"] && panel_dimensions
          params["window_panels"].each do |panel|
            panel_id = panel["id"]
            if panel_dimensions[panel_id]
              # Frissítjük a panel méreteket a kiszámított értékekkel
              panel["width"] = panel_dimensions[panel_id][:width]
              panel["height"] = panel_dimensions[panel_id][:height]
              panel["left"] = panel_dimensions[panel_id][:left]
              panel["top"] = panel_dimensions[panel_id][:top]
            end
          end
        end
        
        # A MEGLÉVŐ komponenslistát lekérjük
        existing_list = WindowGenerator::Main.class_variable_get(:@@components_list)
        
        # Komponensek generálása a megadott darabszámban
        quantity.times do
          # Paraméterek kinyerése - bővebb verzió az új mezőkkel
          # Tok paraméterek
          frame_wood_width = params["frame_wood_width"].to_f
          frame_wood_thickness = params["frame_wood_thickness"].to_f
          
          # Fríz paraméterek
          # Ha window_frieze_width/depth nincs megadva, akkor sash_wood_width/thickness-t használunk
          # vagy alapértelmezett értékként 60/40-et adunk
          frieze_width = params["window_frieze_width"].to_f if params["window_frieze_width"]
          frieze_width ||= params["sash_wood_width"].to_f if params["sash_wood_width"]
          frieze_width ||= 60.0
          
          frieze_thickness = params["window_frieze_depth"].to_f if params["window_frieze_depth"]
          frieze_thickness ||= params["sash_wood_thickness"].to_f if params["sash_wood_thickness"]
          frieze_thickness ||= 40.0
          
          # Csap hossza
          tenon_length = params["window_tenon_length"].to_f if params["window_tenon_length"]
          tenon_length ||= 10.0
          
          # Ablak típus és méret paraméterek
          window_type = params["window_type"] || "Egyszárnyú"
          frame_width = params["frame_width"].to_f
          frame_height = params["frame_height"].to_f
          
          # Nyíló levonások
          sash_width_deduction = params["sash_width_deduction"].to_f
          sash_height_deduction = params["sash_height_deduction"].to_f
          sash_double_deduction = params["sash_double_deduction"].to_f
          
          # Aszimmetrikus beállítások
          is_asymmetric = params["window_is_asymmetric"] || false
          main_wing_ratio = params["window_main_wing_ratio"].to_f if params["window_main_wing_ratio"]
          main_wing_ratio ||= 60.0 # Alapértelmezett 60%
          
          # Osztók paraméterek
          division_wood_width = params["window_division_wood_width"].to_f if params["window_division_wood_width"]
          division_wood_width ||= frieze_width # Alapértelmezett érték a fríz szélessége
          
          division_wood_thickness = params["window_division_wood_depth"].to_f if params["window_division_wood_depth"]
          division_wood_thickness ||= frieze_thickness # Alapértelmezett érték a fríz vastagsága
          
          # Függőleges osztók
          vertical_division_width = params["window_vertical_division_width"].to_f if params["window_vertical_division_width"]
          vertical_division_width ||= 82
          
          vertical_division_thickness = params["window_vertical_division_depth"].to_f if params["window_vertical_division_depth"]
          vertical_division_thickness ||= 68
          
          # Alsó csapos elemek
          lower_tenoned_width = params["window_lower_tenoned_width"].to_f if params["window_lower_tenoned_width"]
          lower_tenoned_width ||= 82
          
          lower_tenoned_thickness = params["window_lower_tenoned_depth"].to_f if params["window_lower_tenoned_depth"]
          lower_tenoned_thickness ||= 68
          
          # Felső csapos elemek
          upper_tenoned_width = params["window_upper_tenoned_width"].to_f if params["window_upper_tenoned_width"]
          upper_tenoned_width ||=82
          
          upper_tenoned_thickness = params["window_upper_tenoned_depth"].to_f if params["window_upper_tenoned_depth"]
          upper_tenoned_thickness ||= 68
          
          # Osztók száma
          horizontal_divisions = params["horizontal_divisions"].to_i if params["horizontal_divisions"]
          horizontal_divisions ||= params["window_horizontal_divisions"].to_i if params["window_horizontal_divisions"]
          horizontal_divisions ||= 0
          
          vertical_divisions = params["vertical_divisions"].to_i if params["vertical_divisions"]
          vertical_divisions ||= params["window_vertical_divisions"].to_i if params["window_vertical_divisions"]
          vertical_divisions ||= 0
          
          # Manuális távolságok - az ajtó modulból átemelve
          manual_horizontal_positions = params["manualHorizontalPositions"]
          manual_vertical_positions = params["manualVerticalPositions"]
          use_manual_distances = true if manual_horizontal_positions || manual_vertical_positions
          
          puts "Ablak méretszámítás:"
          puts "  Tok méret: #{frame_width}mm x #{frame_height}mm"
          puts "  Tok anyag: #{frame_wood_width}mm x #{frame_wood_thickness}mm"
          puts "  Fríz anyag: #{frieze_width}mm x #{frieze_thickness}mm"
          puts "  Ablak típus: #{window_type}"
          puts "  Vízszintes osztók száma: #{horizontal_divisions}"
          puts "  Függőleges osztók száma: #{vertical_divisions}"
          
          # Panel adatok kezelése
          panel_data = params["window_panels"] || []
          puts "Panel adatok: #{panel_data.inspect}"
          
          # Komponensek összegyűjtése a bővített paraméterekkel
          components = collect_window_components(
            frame_wood_width, frame_wood_thickness,
            frieze_width, frieze_thickness,
            tenon_length,
            lower_tenoned_width, lower_tenoned_thickness,
            division_wood_width, division_wood_thickness,
            upper_tenoned_width, upper_tenoned_thickness,
            vertical_division_width, vertical_division_thickness,
            window_type, frame_width, frame_height,
            sash_width_deduction, sash_height_deduction,
            sash_double_deduction,
            vertical_divisions, horizontal_divisions,
            is_asymmetric, main_wing_ratio,
            use_manual_distances, manual_horizontal_positions, manual_vertical_positions,
            params
          )
          
          # Panel komponensek integrálása, ha van PanelComponents modul
          if defined?(WindowGenerator::PanelComponents) && WindowGenerator::PanelComponents.respond_to?(:integrate_panel_components)
            begin
              puts "Panel komponensek integrálása..."
              components = WindowGenerator::PanelComponents.integrate_panel_components(params, components, "Ablak")
            rescue => e
              puts "Hiba a panel komponensek integrálásakor: #{e.message}"
            end
          end
          
          # Ablak méret megjelenítéshez
          frame_size = "#{frame_width.to_i}mm x #{frame_height.to_i}mm"
          
          # Az összegyűjtött komponensek listája az elem típussal és mérettel
          element = {
            element_type: "Ablak",
            frame_size: frame_size,
            window_type: window_type,
            components: components,
            panel_data: panel_data
          }
          
          # Hozzáadjuk az új elem komponenseit a listához
          existing_list << element
          puts "Ablak komponensek hozzáadva a listához. Jelenlegi elemszám: #{existing_list.length}"
        end
        
        # A komponensek listáját visszaadjuk
        formatted_list = WindowGenerator::Main.format_components_list(existing_list)
        puts "Formázott lista: #{formatted_list}"
        return formatted_list
      rescue => e
        puts "Hiba történt: #{e.message}"
        puts e.backtrace.join("\n")
        return "Hiba: #{e.message}"
      end
    end

    # Ablak komponensek összegyűjtése - kibővített verzió az ajtók mintájára
    def self.collect_window_components(
      frame_wood_width, frame_wood_thickness,
      frieze_width, frieze_thickness,
      tenon_length,
      lower_tenoned_width, lower_tenoned_thickness,
      division_wood_width, division_wood_thickness,
      upper_tenoned_width, upper_tenoned_thickness,
      vertical_division_width, vertical_division_thickness,
      window_type, frame_width, frame_height,
      sash_width_deduction, sash_height_deduction,
      sash_double_deduction,
      vertical_divisions = 0, horizontal_divisions = 0,
      is_asymmetric = false, main_wing_ratio = 50,
      use_manual_distances = false, manual_horizontal_positions = nil, manual_vertical_positions = nil,
      params = {}
    )
      puts "\n[DEBUG] collect_window_components függvény meghívva"
      puts "[DEBUG] Paraméterek:"
      puts "  - frame_wood_width: #{frame_wood_width}"
      puts "  - frame_wood_thickness: #{frame_wood_thickness}"
      puts "  - frieze_width: #{frieze_width}"
      puts "  - frieze_thickness: #{frieze_thickness}"
      puts "  - window_type: #{window_type}"
      puts "  - frame_width: #{frame_width}"
      puts "  - frame_height: #{frame_height}"
      puts "  - Vízszintes osztók száma: #{horizontal_divisions}"
      puts "  - Függőleges osztók száma: #{vertical_divisions}"
      
      components = []

      # Tok komponensek generálása minden típushoz
      components << ["Tok alsó vízszintes", frame_width, frame_wood_width, frame_wood_thickness]
      components << ["Tok felső vízszintes", frame_width, frame_wood_width, frame_wood_thickness]
      components << ["Tok bal oldali függőleges", frame_height, frame_wood_width, frame_wood_thickness]
      components << ["Tok jobb oldali függőleges", frame_height, frame_wood_width, frame_wood_thickness]

      puts "Tok komponensek generálása..."

      # Számoljuk ki a nyíló belméretét - csak a felhasználói levonás figyelembevételével
      # A tok fa szélességét nem kell figyelembe venni, az csak az alkatrészlista miatt lényeges
      sash_width = frame_width - sash_width_deduction
      sash_height = frame_height - sash_height_deduction

      # Ha nem üvegfal, akkor nyíló elemek is kellenek
      if window_type != "Üvegfal"
        puts "Nyíló elemek méretszámítása:"
        puts "  Nyíló belméret: #{sash_width}mm x #{sash_height}mm"
        
        # Kétszárnyú vagy tokosztós ablakok egyedi logikája
        if window_type == "Kétszárnyú" || window_type == "Tokosztós"
          if window_type == "Kétszárnyú" 
            # Kétszárnyú, aszimmetrikus kezelése
            if is_asymmetric && main_wing_ratio > 0 && main_wing_ratio < 100
              puts "Aszimmetrikus kétszárnyú ablak, fő szárny aránya: #{main_wing_ratio}%"
              # Fix 26mm-es egymásra takarás hozzáadása az aszimmetrikus ablakoknál is
              nyilo_egymastakaro = 26 # 26mm egymásra takarás
              # Nyíló szélesség kiszámítása a megadott aránnyal
              main_sash_width = (sash_width * (main_wing_ratio / 100.0)).to_i + (nyilo_egymastakaro / 2)
              second_sash_width = sash_width - main_sash_width + (nyilo_egymastakaro / 2)
              puts "Aszimmetrikus kétszárnyú ablak, egymásra takarás: #{nyilo_egymastakaro}mm (hozzáadva)"
              
              # Fő szárny komponensek
              puts "Fő szárny méret: #{main_sash_width}mm x #{sash_height}mm"
              components << ["Nyíló alsó vízszintes", main_sash_width, frieze_width, frieze_thickness]
              components << ["Nyíló felső vízszintes", main_sash_width, frieze_width, frieze_thickness]
              components << ["Nyíló bal oldali függőleges", sash_height, frieze_width, frieze_thickness]
              components << ["Nyíló jobb oldali függőleges", sash_height, frieze_width, frieze_thickness]
              
              # Második szárny komponensek
              puts "Második szárny méret: #{second_sash_width}mm x #{sash_height}mm"
              components << ["Második szárny alsó vízszintes", second_sash_width, frieze_width, frieze_thickness]
              components << ["Második szárny felső vízszintes", second_sash_width, frieze_width, frieze_thickness]
              components << ["Második szárny bal oldali függőleges", sash_height, frieze_width, frieze_thickness]
              components << ["Második szárny jobb oldali függőleges", sash_height, frieze_width, frieze_thickness]
            else
              # Szimmetrikus kétszárnyú
              # Fix 26mm-es egymásra takarás hozzáadása a szárny szélességéhez
              nyilo_egymastakaro = 26 # 26mm egymásra takarás
              half_sash_width = (sash_width + nyilo_egymastakaro) / 2
              puts "Szimmetrikus kétszárnyú, szárny szélesség: #{half_sash_width}mm (#{nyilo_egymastakaro}mm egymásra takarással hozzáadva)"
              
              # Első szárny
              components << ["Nyíló alsó vízszintes", half_sash_width, frieze_width, frieze_thickness]
              components << ["Nyíló felső vízszintes", half_sash_width, frieze_width, frieze_thickness]
              components << ["Nyíló bal oldali függőleges", sash_height, frieze_width, frieze_thickness]
              components << ["Nyíló jobb oldali függőleges", sash_height, frieze_width, frieze_thickness]
              
              # Második szárny
              components << ["Második szárny alsó vízszintes", half_sash_width, frieze_width, frieze_thickness]
              components << ["Második szárny felső vízszintes", half_sash_width, frieze_width, frieze_thickness]
              components << ["Második szárny bal oldali függőleges", sash_height, frieze_width, frieze_thickness]
              components << ["Második szárny jobb oldali függőleges", sash_height, frieze_width, frieze_thickness]
            end
          elsif window_type == "Tokosztós"
            # Tokosztó elemet középre helyezzük
            tokoszto_length = frame_height - (2 * frame_wood_width)
            components << ["Függőleges tokosztó", tokoszto_length, frame_wood_width, frame_wood_thickness]
            
            # Két egyforma nyíló a tokosztó két oldalán
            half_sash_width = (sash_width - sash_double_deduction) / 2
            puts "Tokosztós ablak, nyíló szélesség: #{half_sash_width}mm"
            
            # Első nyíló
            components << ["Bal nyíló alsó vízszintes", half_sash_width, frieze_width, frieze_thickness]
            components << ["Bal nyíló felső vízszintes", half_sash_width, frieze_width, frieze_thickness]
            components << ["Bal nyíló bal függőleges", sash_height, frieze_width, frieze_thickness]
            components << ["Bal nyíló jobb függőleges", sash_height, frieze_width, frieze_thickness]
            
            # Második nyíló
            components << ["Jobb nyíló alsó vízszintes", half_sash_width, frieze_width, frieze_thickness]
            components << ["Jobb nyíló felső vízszintes", half_sash_width, frieze_width, frieze_thickness]
            components << ["Jobb nyíló bal függőleges", sash_height, frieze_width, frieze_thickness]
            components << ["Jobb nyíló jobb függőleges", sash_height, frieze_width, frieze_thickness]
          end
        else
          # Egyszárnyú ablak esetén
          components << ["Nyíló alsó vízszintes", sash_width, frieze_width, frieze_thickness]
          components << ["Nyíló felső vízszintes", sash_width, frieze_width, frieze_thickness]
          components << ["Nyíló bal oldali függőleges", sash_height, frieze_width, frieze_thickness]
          components << ["Nyíló jobb oldali függőleges", sash_height, frieze_width, frieze_thickness]
        end
        
        puts "Nyíló komponensek generálása befejeződött"
        
        # Ha vannak vízszintes osztók
        if horizontal_divisions > 0
          puts "Vízszintes osztók generálása: #{horizontal_divisions} db"
          
          # Kiszámítjuk az osztóközöket a manuálisan megadott pozíciók alapján vagy egyenletesen
          division_positions = []
          
          if use_manual_distances && manual_horizontal_positions && !manual_horizontal_positions.empty?
            puts "Manuális vízszintes osztó pozíciók használata"
            manual_horizontal_positions.each do |pos|
              if pos.is_a?(Numeric) && pos > 0 && pos < sash_height
                division_positions << pos
              end
            end
          else
            # Egyenletes osztóközök
            division_step = sash_height / (horizontal_divisions + 1)
            puts "Vízszintes osztóköz: #{division_step}mm"
            (1..horizontal_divisions).each do |i|
              division_positions << (i * division_step).round
            end
          end
          
          # Vízszintes osztók hozzáadása minden nyílóhoz
          division_positions.each_with_index do |pos, idx|
            division_name = "Vízszintes osztó #{idx+1}"
            
            if window_type == "Kétszárnyú"
              if is_asymmetric
                # Aszimmetrikus esetén különböző méretű osztók
                # A fő szárny osztójának szélessége: nyiló belmérete mínusz a fríz szélessége kétszer, plusz a csap hossza kétszer
                main_division_width = (sash_width * (main_wing_ratio / 100.0)).to_i - (2 * frieze_width) + (2 * tenon_length)
                # A második szárny osztójának szélessége: maradék szélesség mínusz a fríz szélessége kétszer, plusz a csap hossza kétszer
                second_division_width = sash_width - main_division_width - sash_double_deduction - (2 * frieze_width) + (2 * tenon_length)
                
                components << ["#{division_name} (fő szárny)", main_division_width, division_wood_width, division_wood_thickness]
                components << ["#{division_name} (második szárny)", second_division_width, division_wood_width, division_wood_thickness]
              else
                # Szimmetrikus esetén azonos méretű osztók
                # A szárny osztójának szélessége: nyiló belmérete mínusz a fríz szélessége kétszer, plusz a csap hossza kétszer
                # Fix 26mm-es egymásra takarás hozzáadása a szárny szélességéhez
                nyilo_egymastakaro = 26 # 26mm egymásra takarás
                half_division_width = (sash_width + nyilo_egymastakaro) / 2 - (2 * frieze_width) + (2 * tenon_length)
                components << ["#{division_name} (bal szárny)", half_division_width, division_wood_width, division_wood_thickness]
                components << ["#{division_name} (jobb szárny)", half_division_width, division_wood_width, division_wood_thickness] 
              end
            elsif window_type == "Tokosztós"
              # Tokosztós esetén két egyforma méretű nyílóban osztók
              # A szárny osztójának szélessége: nyiló belmérete mínusz a fríz szélessége kétszer, plusz a csap hossza kétszer
              half_division_width = (sash_width - sash_double_deduction) / 2 - (2 * frieze_width) + (2 * tenon_length)
              components << ["#{division_name} (bal oldal)", half_division_width, division_wood_width, division_wood_thickness]
              components << ["#{division_name} (jobb oldal)", half_division_width, division_wood_width, division_wood_thickness]
            else
              # Egyszárnyú esetén egyszerű
              # Az osztó szélessége: nyiló belmérete mínusz a fríz szélessége kétszer, plusz a csap hossza kétszer
              division_width = sash_width - (2 * frieze_width) + (2 * tenon_length)
              components << [division_name, division_width, division_wood_width, division_wood_thickness]
            end
          end
        end
        
        # Ha vannak függőleges osztók
        if vertical_divisions > 0
          puts "Függőleges osztók generálása: #{vertical_divisions} db"
          
          # Kiszámítjuk az osztóközöket a manuálisan megadott pozíciók alapján vagy egyenletesen
          division_positions = []
          
          if use_manual_distances && manual_vertical_positions && !manual_vertical_positions.empty?
            puts "Manuális függőleges osztó pozíciók használata"
            manual_vertical_positions.each do |pos|
              if pos.is_a?(Numeric) && pos > 0 && pos < sash_width
                division_positions << pos
              end
            end
          else
            # Egyenletes osztóközök
            if window_type == "Kétszárnyú" || window_type == "Tokosztós"
              # Kétszárnyú/tokosztós esetén külön számoljuk a pozíciókat szárnyakra
              if window_type == "Kétszárnyú" && is_asymmetric
                # Aszimmetrikus kétszárnyú ablak esetén
                main_sash_width = (sash_width * (main_wing_ratio / 100.0)).to_i
                second_sash_width = sash_width - main_sash_width - sash_double_deduction
                
                # Fő szárnyban osztóközök
                if vertical_divisions > 0
                  main_division_step = main_sash_width / (vertical_divisions + 1)
                  (1..vertical_divisions).each do |i|
                    division_positions << { 
                      wing: "main", 
                      position: (i * main_division_step).round 
                    }
                  end
                end
                
                # Második szárnyban osztóközök (kivéve ha tiltva van)
                if vertical_divisions > 0 && !params["disable_narrow_wing_vertical_divisions"]
                  second_division_step = second_sash_width / (vertical_divisions + 1)
                  (1..vertical_divisions).each do |i|
                    division_positions << { 
                      wing: "second", 
                      position: (i * second_division_step).round 
                    }
                  end
                end
              else
                # Szimmetrikus kétszárnyú/tokosztós
                half_sash_width = (sash_width - sash_double_deduction) / 2
                division_step = half_sash_width / (vertical_divisions + 1)
                
                # Bal szárny/oldal
                (1..vertical_divisions).each do |i|
                  division_positions << { 
                    wing: "left", 
                    position: (i * division_step).round 
                  }
                end
                
                # Jobb szárny/oldal
                (1..vertical_divisions).each do |i|
                  division_positions << { 
                    wing: "right", 
                    position: (i * division_step).round 
                  }
                end
              end
            else
              # Egyszárnyú esetén egyszerű számítás
              division_step = sash_width / (vertical_divisions + 1)
              (1..vertical_divisions).each do |i|
                division_positions << (i * division_step).round
              end
            end
          end
          
          # Függőleges osztók hozzáadása
          division_positions.each_with_index do |pos, idx|
            if pos.is_a?(Hash) # Kétszárnyú/tokosztós speciális eset
              wing = pos[:wing]
              position = pos[:position]
              division_name = "Függőleges osztó #{idx+1} (#{wing} szárny)"
              
              # Függőleges osztó magassága a vízszintes osztók számától függ
              if horizontal_divisions > 0
                # Minden vízszintes osztó között egy darab
                # A nyíló belmérete: nyíló magassága mínusz a fríz szélessége kétszer
                sash_inner_height = sash_height - (2 * frieze_width)
                # A vízszintes osztók által elfoglalt tér: osztók száma * osztó szélesség
                horizontal_divisions_space = horizontal_divisions * division_wood_width
                # A fennmaradó tér: nyíló belméret mínusz a vízszintes osztók által elfoglalt tér
                remaining_space = sash_inner_height - horizontal_divisions_space
                # Ezt osztjuk el a szakaszok száma szerint (osztók száma + 1)
                section_height = remaining_space / (horizontal_divisions + 1)
                # Hozzáadjuk a csap hosszát kétszer (minden szakaszhoz)
                division_height = (section_height + (2 * tenon_length)).to_i
                (horizontal_divisions + 1).times do |section|
                  section_name = "#{division_name} (#{section+1}. szakasz)"
                  components << [section_name, division_height, vertical_division_width, vertical_division_thickness]
                end
              else
                # Egyetlen teljes magasságú osztó
                # A nyíló belmérete: nyíló magassága mínusz a fríz szélessége kétszer
                sash_inner_height = sash_height - (2 * frieze_width)
                # A vízszintes osztók által elfoglalt tér: osztók száma * osztó szélesség
                horizontal_divisions_space = horizontal_divisions * division_wood_width
                # A fennmaradó tér: nyíló belméret mínusz a vízszintes osztók által elfoglalt tér
                remaining_space = sash_inner_height - horizontal_divisions_space
                # Ezt osztjuk el a szakaszok száma szerint (osztók száma + 1)
                section_height = remaining_space / (horizontal_divisions + 1)
                # Hozzáadjuk a csap hosszát kétszer (minden szakaszhoz)
                division_height = (section_height + (2 * tenon_length)).to_i
                components << [division_name, division_height, vertical_division_width, vertical_division_thickness]
              end
            else # Egyszárnyú eset
              division_name = "Függőleges osztó #{idx+1}"
              
              # Függőleges osztó magassága a vízszintes osztók számától függ
              if horizontal_divisions > 0
                # Minden vízszintes osztó között egy darab
                division_height = sash_height / (horizontal_divisions + 1)
                (horizontal_divisions + 1).times do |section|
                  section_name = "#{division_name} (#{section+1}. szakasz)"
                  components << [section_name, division_height, vertical_division_width, vertical_division_thickness]
                end
              else
                # Egyetlen teljes magasságú osztó
                # A függőleges osztó magassága: nyíló magassága mínusz a fríz szélessége kétszer, plusz a csap hossza kétszer
                division_height = sash_height - (2 * frieze_width) + (2 * tenon_length)
                components << [division_name, division_height, vertical_division_width, vertical_division_thickness]
              end
            end
          end
        end
        
        # Alsó és felső csapos elemek generálása, ha van vízszintes és/vagy függőleges osztó
        # És csak akkor, ha nincs panel adat (a panel_data üres vagy nil)
        if (horizontal_divisions > 0 || vertical_divisions > 0) && (params["window_panels"].nil? || params["window_panels"].empty?)
          puts "Csapos elemek generálása..."
          
          # Alsó csapos elemek (alsó és felső vízszintes elemek közötti függőleges bordák)
          if vertical_divisions > 0
            if window_type == "Kétszárnyú" || window_type == "Tokosztós"
              # Kétszárnyú/tokosztós esetén külön számítás a szárnyakra
              if window_type == "Kétszárnyú" && is_asymmetric
                # Aszimmetrikus kétszárnyú
                main_sash_width = (sash_width * (main_wing_ratio / 100.0)).to_i
                second_sash_width = sash_width - main_sash_width - sash_double_deduction
                
                # Fő szárny csapos elemei
                main_division_step = main_sash_width / (vertical_divisions + 1)
                (1..vertical_divisions).each do |i|
                  components << ["Alsó csapos #{i} (fő szárny)", lower_tenoned_width, lower_tenoned_thickness, tenon_length]
                  components << ["Felső csapos #{i} (fő szárny)", upper_tenoned_width, upper_tenoned_thickness, tenon_length]
                end
                
                # Második szárny csapos elemei (ha nincs tiltva)
                if !params["disable_narrow_wing_vertical_divisions"]
                  second_division_step = second_sash_width / (vertical_divisions + 1)
                  (1..vertical_divisions).each do |i|
                    components << ["Alsó csapos #{i} (második szárny)", lower_tenoned_width, lower_tenoned_thickness, tenon_length]
                    components << ["Felső csapos #{i} (második szárny)", upper_tenoned_width, upper_tenoned_thickness, tenon_length]
                  end
                end
              else
                # Szimmetrikus kétszárnyú/tokosztós
                (1..vertical_divisions).each do |i|
                  components << ["Alsó csapos #{i} (bal szárny)", lower_tenoned_width, lower_tenoned_thickness, tenon_length]
                  components << ["Felső csapos #{i} (bal szárny)", upper_tenoned_width, upper_tenoned_thickness, tenon_length]
                  components << ["Alsó csapos #{i} (jobb szárny)", lower_tenoned_width, lower_tenoned_thickness, tenon_length]
                  components << ["Felső csapos #{i} (jobb szárny)", upper_tenoned_width, upper_tenoned_thickness, tenon_length]
                end
              end
            else
              # Egyszárnyú esetén egyszerű
              (1..vertical_divisions).each do |i|
                components << ["Alsó csapos #{i}", lower_tenoned_width, lower_tenoned_thickness, tenon_length]
                components << ["Felső csapos #{i}", upper_tenoned_width, upper_tenoned_thickness, tenon_length]
              end
            end
          end
        else
          puts "Csapos elemek generálása átugorva, mert már vannak panel adatok."
        end
      end

      puts "Ablak komponensek összegyűjtése befejeződött."
      
      # Minden méretértéket egész számra kerekítünk a jobb olvashatóság érdekében
      components_with_integers = components.map do |component|
        # Az első elem a név, a többi a méretek
        name = component[0]
        # A méreteket egész számra kerekítjük
        dimensions = component[1..-1].map { |dim| dim.is_a?(Numeric) ? dim.to_i : dim }
        # Új komponens a névvel és az egész számra kerekített méretekkel
        [name] + dimensions
      end
      
      return components_with_integers
    end
  end
end
