export const fc_project_editor_config = (): string => /* language=editorconfig */ `

root = true

[*]
end_of_line = lf
insert_final_newline = true

charset = utf-8
indent_style = space
indent_size = 2

ij_any_else_on_new_line = true
ij_any_catch_on_new_line = true
ij_any_finally_on_new_line = true
ij_typescript_spaces_within_object_literal_braces = true
ij_typescript_spaces_within_imports = true
ij_javascript_spaces_within_object_literal_braces = true
ij_javascript_spaces_within_imports = true

`.trim();
