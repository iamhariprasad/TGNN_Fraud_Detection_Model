package com.fraud.dto;

import com.fraud.model.User;
import jakarta.validation.constraints.*;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserDto {
    private Long id;
    @NotBlank(message = "Username is required") @Size(min = 3, max = 50)
    private String username;
    @NotBlank @Email
    private String email;
    private String firstName;
    private String lastName;
    private User.Role role;
    private Boolean isActive;
    public static UserDto fromEntity(User user) {
        return UserDto.builder().id(user.getId()).username(user.getUsername()).email(user.getEmail())
            .firstName(user.getFirstName()).lastName(user.getLastName()).role(user.getRole()).isActive(user.getIsActive()).build();
    }
}
