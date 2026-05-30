CREATE OR REPLACE FUNCTION public.handle_new_user_household()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.household_profiles (owner_id, name, role, color, initials, sort_order) values
    (new.id, 'Household', 'shared', '#7BA37A', 'HH', 0),
    (new.id, 'Mom',       'parent', '#A7C29A', 'MO', 1),
    (new.id, 'Dad',       'parent', '#C9A36B', 'DA', 2),
    (new.id, 'Kid',       'kid',    '#E8B774', 'K1', 3);
  return new;
end;
$function$;